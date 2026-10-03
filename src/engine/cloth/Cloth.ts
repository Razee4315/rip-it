/**
 * Tearable cloth — XPBD solver over a triangle mesh whose topology changes at runtime.
 *
 * The mesh is the truth: particles are shared by a "fan" of triangles, and cloth comes apart
 * by *splitting particles* so neighbouring triangles stop sharing them. A tear opens
 * perpendicular to the stress that caused it and concentrates load at its tip, so rips run
 * the way they do in real fabric. Cuts mark edges and let the fans fall apart along them.
 *
 * Everything lives in typed arrays; the hot loops allocate nothing.
 */
import { clamp, hash01 } from "../math";
import type { Fabric } from "./fabrics";
import type { Wind } from "./wind";

/** Fixed physics substep. Every device runs the same simulation; slow ones just run fewer per frame. */
export const DT = 1 / 720;
/** tear checks run every Nth substep, on settled positions */
const TEAR_EVERY = 3;
export const MAX_FAN = 8;

export const PIN_NONE = 0;
export const PIN_MOUNT = 1;
export const PIN_USER = 2;

export const EV_TEAR = 1;
export const EV_CUT = 2;
export const EV_BURN = 3;
export const EV_STEAM = 4;
export const EV_STRIDE = 8;
const MAX_EV = 256;

export type Collider =
	| { kind: "sphere"; x: number; y: number; z: number; r: number }
	| { kind: "box"; x: number; y: number; z: number; hx: number; hy: number; hz: number };

export type ClothBuild = {
	cols: number;
	rows: number;
	/** rest size in metres */
	width: number;
	height: number;
	fabric: Fabric;
	/** (cols+1)*(rows+1)*3 starting positions */
	positions: Float32Array;
	/** per grid vertex, non-zero = pinned where it starts */
	pins: Uint8Array;
	floorY: number;
	wallZ: number;
	colliders?: Collider[];
};

export type Grab = {
	n: number;
	idx: Int32Array;
	wgt: Float32Array;
	off: Float32Array;
	tx: number;
	ty: number;
	tz: number;
	/** how far the hand is from where it wants to be (m) — drives creaks and haptics */
	strain: number;
};

const GRAB_CAP = 48;
const lab = new Int32Array(MAX_FAN);
const ft = new Int32Array(MAX_FAN);
const moveBuf = new Int32Array(MAX_FAN);
const wtmp = new Float32Array(3);
/** wind is sampled on a coarse lattice over the cloth and interpolated per triangle */
const LX = 7;
const LY = 6;
const lat = new Float32Array(LX * LY * 3);
/** how far from a holding hand (metres, squared) a pull can start a rip */
const HAND_REACH2 = 0.55 * 0.55;

export class Cloth {
	readonly cols: number;
	readonly rows: number;
	readonly width: number;
	readonly height: number;
	readonly spacing: number;
	readonly fabric: Fabric;
	readonly n0: number;
	readonly nt: number;
	readonly maxP: number;
	readonly maxE: number;

	np = 0;
	ne = 0;

	// ── particles ──────────────────────────────────────────────
	pos: Float32Array;
	prev: Float32Array;
	vel: Float32Array;
	acc: Float32Array;
	nrm: Float32Array;
	uv: Float32Array;
	/** unpinned inverse mass */
	w0: Float32Array;
	/** effective inverse mass (0 when pinned) */
	im: Float32Array;
	pin: Uint8Array;
	alive: Uint8Array;
	origin: Int32Array;
	wet: Float32Array;
	/** 0 fresh → 1 burnt through */
	burn: Float32Array;
	/** ignition progress / residual heat */
	heat: Float32Array;
	burning: Uint8Array;
	/** 0..1 ragged-edge amount for the shader */
	fray: Float32Array;
	/** 0..1 visible mending stitches */
	seam: Float32Array;
	fan: Int32Array;
	fanN: Uint8Array;
	/** projected screen position (px) — valid after project() */
	scr: Float32Array;
	private floorOff: Float32Array;
	private stroke: Uint8Array;
	private freeP: Int32Array;
	private nFreeP = 0;

	// ── triangles ──────────────────────────────────────────────
	tri: Int32Array;
	triE: Int32Array;
	triAlive: Uint8Array;
	triArea: Float32Array;
	/** bit 0: inside the level's target region */
	triTag: Uint8Array;

	// ── edges ──────────────────────────────────────────────────
	ea: Int32Array;
	eb: Int32Array;
	eT0: Int32Array;
	eT1: Int32Array;
	eO0: Int32Array;
	eO1: Int32Array;
	eRest: Float32Array;
	eBend: Float32Array;
	/** strain at which the edge rips, before damage */
	eThr: Float32Array;
	/** strength multiplier (bias direction, reinforced hems) */
	eMul: Float32Array;
	/** 1 pristine → 0 about to go */
	eDmg: Float32Array;
	eAlive: Uint8Array;
	eCut: Uint8Array;
	private freeE: Int32Array;
	private nFreeE = 0;

	// ── world ──────────────────────────────────────────────────
	gravity = -9.81;
	floorY: number;
	wallZ: number;
	colliders: Collider[];
	/** per-edge tension the hand can apply */
	handForce = 2600;
	bendOn = true;
	/** when false nothing tears (settling, cutscenes) */
	tearOn = true;
	time = 0;

	grabs: Grab[] = [];

	// ── bookkeeping ────────────────────────────────────────────
	/** bumps whenever triangles or their vertices change — renderer rebuilds indices */
	topoVersion = 0;
	/** bumps whenever uv changes */
	uvVersion = 0;
	initialArea = 0;
	targetArea = 0;
	tearCount = 0;
	cutCount = 0;
	nBurning = 0;
	anyWet = false;
	anyHeat = false;
	burntArea = 0;

	ev = new Float32Array(EV_STRIDE * MAX_EV);
	evN = 0;
	/** floor landings since last cleared: count, hardest speed and where */
	impactN = 0;
	impactV = 0;
	impactX = 0;
	impactZ = 0;

	// analysis results (see analyze())
	pieces = 1;
	aliveArea = 0;
	hangingArea = 0;
	parent: Int32Array;
	compArea: Float32Array;
	compTag: Float32Array;
	compPin: Uint8Array;

	private cand = new Int32Array(8);
	private candR = new Float32Array(8);
	private stepN = 0;
	/** seconds for which tears may start anywhere (see substep) */
	private gate = 0;
	private strokeLast = -1;
	private compliance: number;

	constructor(b: ClothBuild) {
		const { cols, rows } = b;
		this.cols = cols;
		this.rows = rows;
		this.width = b.width;
		this.height = b.height;
		this.fabric = b.fabric;
		this.floorY = b.floorY;
		this.wallZ = b.wallZ;
		this.colliders = b.colliders ?? [];
		const nx = cols + 1,
			ny = rows + 1;
		const n0 = nx * ny;
		const nt = cols * rows * 2;
		this.n0 = n0;
		this.nt = nt;
		this.maxP = Math.min(65535, nt * 3);
		this.maxE = nt * 3 + 8;
		this.spacing = (b.width / cols + b.height / rows) / 2;
		this.compliance = b.fabric.stretch + (DT * DT) / b.fabric.mass;

		const mp = this.maxP;
		this.pos = new Float32Array(mp * 3);
		this.prev = new Float32Array(mp * 3);
		this.vel = new Float32Array(mp * 3);
		this.acc = new Float32Array(mp * 3);
		this.nrm = new Float32Array(mp * 3);
		this.uv = new Float32Array(mp * 2);
		this.w0 = new Float32Array(mp);
		this.im = new Float32Array(mp);
		this.pin = new Uint8Array(mp);
		this.alive = new Uint8Array(mp);
		this.origin = new Int32Array(mp);
		this.wet = new Float32Array(mp);
		this.burn = new Float32Array(mp);
		this.heat = new Float32Array(mp);
		this.burning = new Uint8Array(mp);
		this.fray = new Float32Array(mp);
		this.seam = new Float32Array(mp);
		this.fan = new Int32Array(mp * MAX_FAN);
		this.fanN = new Uint8Array(mp);
		this.scr = new Float32Array(mp * 2);
		this.floorOff = new Float32Array(mp);
		this.stroke = new Uint8Array(mp);
		this.freeP = new Int32Array(mp);
		this.parent = new Int32Array(mp);
		this.compArea = new Float32Array(mp);
		this.compTag = new Float32Array(mp);
		this.compPin = new Uint8Array(mp);

		this.tri = new Int32Array(nt * 3);
		this.triE = new Int32Array(nt * 3);
		this.triAlive = new Uint8Array(nt);
		this.triArea = new Float32Array(nt);
		this.triTag = new Uint8Array(nt);

		const me = this.maxE;
		this.ea = new Int32Array(me);
		this.eb = new Int32Array(me);
		this.eT0 = new Int32Array(me);
		this.eT1 = new Int32Array(me);
		this.eO0 = new Int32Array(me);
		this.eO1 = new Int32Array(me);
		this.eRest = new Float32Array(me);
		this.eBend = new Float32Array(me);
		this.eThr = new Float32Array(me);
		this.eMul = new Float32Array(me);
		this.eDmg = new Float32Array(me);
		this.eAlive = new Uint8Array(me);
		this.eCut = new Uint8Array(me);
		this.freeE = new Int32Array(me);

		// particles
		const w = 1 / b.fabric.mass;
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const p = j * nx + i;
				this.pos[p * 3] = this.prev[p * 3] = b.positions[p * 3];
				this.pos[p * 3 + 1] = this.prev[p * 3 + 1] = b.positions[p * 3 + 1];
				this.pos[p * 3 + 2] = this.prev[p * 3 + 2] = b.positions[p * 3 + 2];
				this.uv[p * 2] = i / cols;
				this.uv[p * 2 + 1] = j / rows;
				this.w0[p] = w;
				this.pin[p] = b.pins[p] ? PIN_MOUNT : PIN_NONE;
				this.im[p] = b.pins[p] ? 0 : w;
				this.alive[p] = 1;
				this.origin[p] = p;
				this.floorOff[p] = 0.002 + hash01(p) * 0.007;
			}
		this.np = n0;

		// triangles + shared edges; diagonals alternate so the weave has no built-in lean
		const edgeMap = new Map<number, number>();
		const addEdge = (T: number, k: number, a: number, c: number, opp: number, diag: boolean) => {
			const key = a < c ? a * n0 + c : c * n0 + a;
			let e = edgeMap.get(key);
			if (e === undefined) {
				e = this.ne++;
				edgeMap.set(key, e);
				this.ea[e] = a;
				this.eb[e] = c;
				this.eT0[e] = T;
				this.eO0[e] = opp;
				this.eT1[e] = -1;
				this.eO1[e] = -1;
				this.eAlive[e] = 1;
				this.eDmg[e] = 1;
				this.eMul[e] = diag ? b.fabric.bias : 1;
			} else {
				this.eT1[e] = T;
				this.eO1[e] = opp;
			}
			this.triE[T * 3 + k] = e;
		};
		const addTri = (T: number, v0: number, v1: number, v2: number) => {
			this.tri[T * 3] = v0;
			this.tri[T * 3 + 1] = v1;
			this.tri[T * 3 + 2] = v2;
			this.triAlive[T] = 1;
			const isDiag = (p: number, q: number) => {
				const d = Math.abs(p - q);
				return d !== 1 && d !== nx;
			};
			addEdge(T, 0, v0, v1, v2, isDiag(v0, v1));
			addEdge(T, 1, v1, v2, v0, isDiag(v1, v2));
			addEdge(T, 2, v2, v0, v1, isDiag(v2, v0));
			for (const v of [v0, v1, v2]) this.fan[v * MAX_FAN + this.fanN[v]++] = T;
		};
		let T = 0;
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const a = j * nx + i,
					bb = a + 1,
					d = a + nx,
					c = d + 1;
				if (((i + j) & 1) === 0) {
					addTri(T++, a, c, bb);
					addTri(T++, a, d, c);
				} else {
					addTri(T++, a, d, bb);
					addTri(T++, bb, d, c);
				}
			}

		// reinforced hems where the cloth is mounted — grommets don't rip out first
		const near = new Uint8Array(n0);
		const R = 5;
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				if (!b.pins[j * nx + i]) continue;
				for (let dj = -R; dj <= R; dj++)
					for (let di = -R; di <= R; di++) {
						const ii = i + di,
							jj = j + dj;
						if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
						const ring = Math.max(Math.abs(di), Math.abs(dj));
						const q = jj * nx + ii;
						const val = R + 1 - ring;
						if (val > near[q]) near[q] = val;
					}
			}
		// strength multiplier by distance (in cells) from the nearest mount point
		const HEM = [1, 1.3, 1.7, 2.2, 2.8, 3.4, 4];
		for (let e = 0; e < this.ne; e++) {
			this.eMul[e] *= HEM[Math.max(near[this.ea[e]], near[this.eb[e]])];
			this.refreshEdge(e);
		}
		for (let t = 0; t < nt; t++) {
			this.triArea[t] = Math.abs(this.restArea(t));
			this.initialArea += this.triArea[t];
		}
		this.aliveArea = this.hangingArea = this.initialArea;
	}

	// ════════════════════════════════════════════════════════════
	//  rest geometry
	// ════════════════════════════════════════════════════════════

	private restLen(a: number, b: number) {
		const du = (this.uv[a * 2] - this.uv[b * 2]) * this.width;
		const dv = (this.uv[a * 2 + 1] - this.uv[b * 2 + 1]) * this.height;
		return Math.sqrt(du * du + dv * dv);
	}

	private restArea(t: number) {
		const a = this.tri[t * 3],
			b = this.tri[t * 3 + 1],
			c = this.tri[t * 3 + 2];
		return this.uvArea(
			this.uv[a * 2],
			this.uv[a * 2 + 1],
			this.uv[b * 2],
			this.uv[b * 2 + 1],
			this.uv[c * 2],
			this.uv[c * 2 + 1],
		);
	}

	/** signed area in metres² of a triangle given in uv space */
	private uvArea(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
		return (
			0.5 *
			((bx - ax) * this.width * ((cy - ay) * this.height) -
				(cx - ax) * this.width * ((by - ay) * this.height))
		);
	}

	private refreshEdge(e: number) {
		const rest = Math.max(1e-5, this.restLen(this.ea[e], this.eb[e]));
		this.eRest[e] = rest;
		this.eThr[e] = 1 + (this.fabric.strength * this.eMul[e] * this.compliance) / rest;
		const o0 = this.eO0[e],
			o1 = this.eO1[e];
		this.eBend[e] = o0 >= 0 && o1 >= 0 ? this.restLen(o0, o1) : 0;
	}

	/** Recompute rest state of everything touching particle v (after its uv moved). */
	private refreshAround(v: number) {
		const base = v * MAX_FAN;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			for (let j = 0; j < 3; j++) this.refreshEdge(this.triE[T * 3 + j]);
			this.triArea[T] = Math.abs(this.restArea(T));
		}
	}

	// ════════════════════════════════════════════════════════════
	//  topology primitives
	// ════════════════════════════════════════════════════════════

	private pushEvent(
		type: number,
		x: number,
		y: number,
		z: number,
		dx: number,
		dy: number,
		dz: number,
		mag: number,
	) {
		if (this.evN >= MAX_EV) return;
		const o = this.evN++ * EV_STRIDE;
		const ev = this.ev;
		ev[o] = type;
		ev[o + 1] = x;
		ev[o + 2] = y;
		ev[o + 3] = z;
		ev[o + 4] = dx;
		ev[o + 5] = dy;
		ev[o + 6] = dz;
		ev[o + 7] = mag;
	}

	private cloneParticle(src: number) {
		const p = this.nFreeP > 0 ? this.freeP[--this.nFreeP] : this.np++;
		const s3 = src * 3,
			p3 = p * 3;
		for (let k = 0; k < 3; k++) {
			this.pos[p3 + k] = this.pos[s3 + k];
			this.prev[p3 + k] = this.prev[s3 + k];
			this.vel[p3 + k] = this.vel[s3 + k];
			this.acc[p3 + k] = this.acc[s3 + k];
			this.nrm[p3 + k] = this.nrm[s3 + k];
		}
		this.uv[p * 2] = this.uv[src * 2];
		this.uv[p * 2 + 1] = this.uv[src * 2 + 1];
		this.scr[p * 2] = this.scr[src * 2];
		this.scr[p * 2 + 1] = this.scr[src * 2 + 1];
		this.w0[p] = this.w0[src];
		this.im[p] = this.im[src];
		this.pin[p] = this.pin[src];
		this.alive[p] = 1;
		this.origin[p] = this.origin[src];
		this.wet[p] = this.wet[src];
		this.burn[p] = this.burn[src];
		this.heat[p] = this.heat[src];
		this.burning[p] = this.burning[src];
		this.fray[p] = this.fray[src];
		this.seam[p] = this.seam[src];
		this.stroke[p] = this.stroke[src];
		this.floorOff[p] = 0.002 + hash01(p * 7 + 3) * 0.007;
		this.fanN[p] = 0;
		this.uvVersion++;
		return p;
	}

	private killParticle(p: number) {
		this.alive[p] = 0;
		this.burning[p] = 0;
		this.pin[p] = PIN_NONE;
		this.fanN[p] = 0;
		this.freeP[this.nFreeP++] = p;
	}

	private newEdge(src: number) {
		const e = this.nFreeE > 0 ? this.freeE[--this.nFreeE] : this.ne++;
		this.ea[e] = this.ea[src];
		this.eb[e] = this.eb[src];
		this.eRest[e] = this.eRest[src];
		this.eBend[e] = 0;
		this.eThr[e] = this.eThr[src];
		this.eMul[e] = this.eMul[src];
		this.eDmg[e] = this.eDmg[src];
		this.eAlive[e] = 1;
		this.eCut[e] = 0;
		this.eT0[e] = this.eT1[e] = -1;
		this.eO0[e] = this.eO1[e] = -1;
		return e;
	}

	private killEdge(e: number) {
		this.eAlive[e] = 0;
		this.freeE[this.nFreeE++] = e;
	}

	private fanRemove(v: number, T: number) {
		const base = v * MAX_FAN;
		const n = this.fanN[v];
		for (let k = 0; k < n; k++)
			if (this.fan[base + k] === T) {
				this.fan[base + k] = this.fan[base + n - 1];
				this.fanN[v] = n - 1;
				return;
			}
	}

	private localIndex(T: number, v: number) {
		const t3 = T * 3;
		return this.tri[t3] === v ? 0 : this.tri[t3 + 1] === v ? 1 : this.tri[t3 + 2] === v ? 2 : -1;
	}

	/** Detach triangle T from edge e, leaving the edge to its other triangle (if any). */
	private edgeDropTri(e: number, T: number) {
		if (this.eT0[e] === T) {
			this.eT0[e] = this.eT1[e];
			this.eO0[e] = this.eO1[e];
		} else if (this.eT1[e] !== T) return;
		this.eT1[e] = -1;
		this.eO1[e] = -1;
		this.eBend[e] = 0;
	}

	/**
	 * Re-home `n` triangles (in moveBuf) from particle v onto particle v2.
	 * Edges shared with a triangle that stays behind are duplicated — that is the crack.
	 */
	private moveTris(v: number, v2: number, n: number) {
		for (let m = 0; m < n; m++) {
			const T = moveBuf[m];
			const kv = this.localIndex(T, v);
			if (kv < 0) continue;
			this.tri[T * 3 + kv] = v2;
			for (let s = 0; s < 2; s++) {
				const le = s === 0 ? kv : (kv + 2) % 3;
				const e = this.triE[T * 3 + le];
				const To = this.eT0[e] === T ? this.eT1[e] : this.eT0[e];
				let moving = To < 0;
				if (!moving) for (let q = 0; q < n; q++) if (moveBuf[q] === To) moving = true;
				if (moving) {
					if (this.ea[e] === v) this.ea[e] = v2;
					else if (this.eb[e] === v) this.eb[e] = v2;
				} else {
					const opp = this.eT0[e] === T ? this.eO0[e] : this.eO1[e];
					const e2 = this.newEdge(e);
					if (this.ea[e2] === v) this.ea[e2] = v2;
					else this.eb[e2] = v2;
					this.eT0[e2] = T;
					this.eO0[e2] = opp;
					this.edgeDropTri(e, T);
					this.eCut[e] = 0;
					this.triE[T * 3 + le] = e2;
				}
			}
			// the edge facing v sees v as its opposite corner on this side
			const eo = this.triE[T * 3 + ((kv + 1) % 3)];
			if (this.eT0[eo] === T) this.eO0[eo] = v2;
			else if (this.eT1[eo] === T) this.eO1[eo] = v2;
			this.fanRemove(v, T);
			this.fan[v2 * MAX_FAN + this.fanN[v2]++] = T;
		}
		this.topoVersion++;
	}

	/**
	 * If v's triangles no longer form one connected fan (ignoring cut edges),
	 * give each loose group its own copy of the particle. Returns copies made.
	 */
	private splitComponents(v: number, frayAmt: number): number {
		const n = this.fanN[v];
		if (n <= 1) return 0;
		const base = v * MAX_FAN;
		for (let k = 0; k < n; k++) {
			lab[k] = k;
			ft[k] = this.fan[base + k];
		}
		for (let k = 0; k < n; k++) {
			const T = ft[k];
			const kv = this.localIndex(T, v);
			for (let s = 0; s < 2; s++) {
				const e = this.triE[T * 3 + (s === 0 ? kv : (kv + 2) % 3)];
				if (this.eCut[e]) continue;
				const To = this.eT0[e] === T ? this.eT1[e] : this.eT0[e];
				if (To < 0) continue;
				for (let m = 0; m < n; m++)
					if (ft[m] === To) {
						let ra = k,
							rb = m;
						while (lab[ra] !== ra) ra = lab[ra];
						while (lab[rb] !== rb) rb = lab[rb];
						if (ra !== rb) lab[rb] = ra;
						break;
					}
			}
		}
		for (let k = 0; k < n; k++) {
			let r = k;
			while (lab[r] !== r) r = lab[r];
			lab[k] = r;
		}
		const keep = lab[0];
		let made = 0;
		for (let k = 1; k < n; k++) {
			const r = lab[k];
			if (r === keep || r < 0) continue;
			let cnt = 0;
			for (let m = k; m < n; m++)
				if (lab[m] === r) {
					moveBuf[cnt++] = ft[m];
					lab[m] = -1;
				}
			const v2 = this.cloneParticle(v);
			this.moveTris(v, v2, cnt);
			if (frayAmt > this.fray[v2]) this.fray[v2] = frayAmt;
			made++;
		}
		if (made && frayAmt > this.fray[v]) this.fray[v] = frayAmt;
		return made;
	}

	/**
	 * Tear particle v along the plane through it with normal n: triangles in front
	 * of the plane leave on a new particle. Returns the new particle or -1.
	 */
	private splitByPlane(v: number, nx: number, ny: number, nz: number): number {
		const n = this.fanN[v];
		if (n < 2) return -1;
		const base = v * MAX_FAN;
		const pos = this.pos;
		const px = pos[v * 3],
			py = pos[v * 3 + 1],
			pz = pos[v * 3 + 2];
		let cnt = 0;
		for (let k = 0; k < n; k++) {
			const T = this.fan[base + k];
			const a = this.tri[T * 3] * 3,
				b = this.tri[T * 3 + 1] * 3,
				c = this.tri[T * 3 + 2] * 3;
			const cx = (pos[a] + pos[b] + pos[c]) / 3 - px,
				cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - py,
				cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - pz;
			if (cx * nx + cy * ny + cz * nz > 0) moveBuf[cnt++] = T;
		}
		if (cnt === 0 || cnt === n) return -1;
		const v2 = this.cloneParticle(v);
		this.moveTris(v, v2, cnt);
		this.fray[v] = this.fray[v2] = 1;
		this.splitComponents(v, 1);
		this.splitComponents(v2, 1);
		return v2;
	}

	private isBorder(v: number) {
		const base = v * MAX_FAN;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			const kv = this.localIndex(T, v);
			if (this.eT1[this.triE[T * 3 + kv]] < 0 || this.eT1[this.triE[T * 3 + ((kv + 2) % 3)]] < 0)
				return true;
		}
		return false;
	}

	killTri(T: number, frayAmt = 0.6) {
		if (!this.triAlive[T]) return;
		this.triAlive[T] = 0;
		for (let k = 0; k < 3; k++) {
			const e = this.triE[T * 3 + k];
			this.edgeDropTri(e, T);
			if (this.eT0[e] < 0) this.killEdge(e);
		}
		for (let k = 0; k < 3; k++) {
			const v = this.tri[T * 3 + k];
			this.fanRemove(v, T);
			if (this.fanN[v] === 0) this.killParticle(v);
			else this.splitComponents(v, frayAmt);
		}
		this.topoVersion++;
	}

	private weakenAround(v: number, f: number) {
		const base = v * MAX_FAN;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			for (let j = 0; j < 3; j++) {
				const e = this.triE[T * 3 + j];
				const d = this.eDmg[e] * f;
				this.eDmg[e] = d < 0.12 ? 0.12 : d;
			}
		}
	}

	/** An edge has been pulled past its limit: open a tear across it. */
	private tearEdge(e: number, mag: number) {
		const a = this.ea[e],
			b = this.eb[e];
		const pos = this.pos;
		let nx = pos[b * 3] - pos[a * 3],
			ny = pos[b * 3 + 1] - pos[a * 3 + 1],
			nz = pos[b * 3 + 2] - pos[a * 3 + 2];
		const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
		nx /= l;
		ny /= l;
		nz /= l;
		// tears like to continue from an existing edge or crack tip
		const ba = this.isBorder(a),
			bb = this.isBorder(b);
		const aFirst = ba === bb ? hash01(e * 31 + this.tearCount) < 0.5 : ba;
		let v = aFirst ? a : b;
		let v2 = aFirst ? this.splitByPlane(a, nx, ny, nz) : this.splitByPlane(b, -nx, -ny, -nz);
		if (v2 < 0) {
			v = aFirst ? b : a;
			v2 = aFirst ? this.splitByPlane(b, -nx, -ny, -nz) : this.splitByPlane(a, nx, ny, nz);
		}
		const mx = (pos[a * 3] + pos[b * 3]) / 2,
			my = (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2,
			mz = (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2;
		if (v2 < 0) {
			// nothing left to split — the last threads holding this scrap simply give way
			const T = this.eT0[e];
			if (T >= 0) this.killTri(T, 1);
		} else {
			const f = 1 - 0.42 * this.fabric.rip;
			this.weakenAround(v, f);
			this.weakenAround(v2, f);
		}
		if (this.eAlive[e]) this.eDmg[e] = Math.min(1, this.eDmg[e] + 0.25);
		this.tearCount++;
		if (this.gate < 0.45) this.gate = 0.45;
		this.pushEvent(EV_TEAR, mx, my, mz, nx, ny, nz, mag);
	}

	// ════════════════════════════════════════════════════════════
	//  simulation
	// ════════════════════════════════════════════════════════════

	/** Refresh effective inverse masses (pins, wetness). */
	refreshMass() {
		const { im, w0, pin, wet, alive } = this;
		let anyWet = false;
		for (let p = 0; p < this.np; p++) {
			if (!alive[p]) continue;
			const wt = wet[p];
			if (wt > 0) anyWet = true;
			im[p] = pin[p] ? 0 : w0[p] / (1 + wt * 1.4);
		}
		this.anyWet = anyWet;
	}

	/**
	 * Per-frame pass: vertex normals, plus aerodynamic push from the wind on every triangle.
	 * Writes accelerations into `acc` for the substeps that follow.
	 */
	prepare(wind: Wind | null) {
		const { pos, vel, acc, nrm, tri, triAlive, im, alive } = this;
		const np = this.np;
		nrm.fill(0, 0, np * 3);
		acc.fill(0, 0, np * 3);
		const cell = this.spacing * this.spacing;
		// coupling rate is capped so light cloth follows the wind without overshooting it
		const k = wind ? Math.min(this.fabric.drag * 5.5, 14 * this.fabric.mass) / cell : 0;
		// The breeze varies smoothly, so evaluate it on a small lattice spanning the cloth and
		// interpolate: a few dozen samples of the wind field per frame instead of thousands.
		let minX = 0,
			minY = 0,
			invDx = 0,
			invDy = 0;
		const jet = wind ? wind.jetOn : false;
		if (wind) {
			let x0 = 1e9,
				x1 = -1e9,
				y0 = 1e9,
				y1 = -1e9,
				zs = 0,
				n = 0;
			for (let p = 0, i = 0; p < np; p++, i += 3) {
				if (!alive[p]) continue;
				const x = pos[i],
					y = pos[i + 1];
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
				zs += pos[i + 2];
				n++;
			}
			if (n === 0) {
				x0 = y0 = 0;
				x1 = y1 = 1;
			}
			const zm = n ? zs / n : 0;
			const dx = Math.max(1e-3, (x1 - x0) / (LX - 1)),
				dy = Math.max(1e-3, (y1 - y0) / (LY - 1));
			for (let j = 0; j < LY; j++)
				for (let i = 0; i < LX; i++) {
					wind.base(x0 + i * dx, y0 + j * dy, zm, wtmp);
					const o = (j * LX + i) * 3;
					lat[o] = wtmp[0];
					lat[o + 1] = wtmp[1];
					lat[o + 2] = wtmp[2];
				}
			minX = x0;
			minY = y0;
			invDx = 1 / dx;
			invDy = 1 / dy;
		}
		for (let t = 0; t < this.nt; t++) {
			if (!triAlive[t]) continue;
			const a = tri[t * 3] * 3,
				b = tri[t * 3 + 1] * 3,
				c = tri[t * 3 + 2] * 3;
			const e1x = pos[b] - pos[a],
				e1y = pos[b + 1] - pos[a + 1],
				e1z = pos[b + 2] - pos[a + 2];
			const e2x = pos[c] - pos[a],
				e2y = pos[c + 1] - pos[a + 1],
				e2z = pos[c + 2] - pos[a + 2];
			const nx = e1y * e2z - e1z * e2y,
				ny = e1z * e2x - e1x * e2z,
				nz = e1x * e2y - e1y * e2x;
			nrm[a] += nx;
			nrm[a + 1] += ny;
			nrm[a + 2] += nz;
			nrm[b] += nx;
			nrm[b + 1] += ny;
			nrm[b + 2] += nz;
			nrm[c] += nx;
			nrm[c + 1] += ny;
			nrm[c + 2] += nz;
			if (wind) {
				const a2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
				if (a2 < 1e-10) continue;
				const cxm = (pos[a] + pos[b] + pos[c]) / 3,
					cym = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
				const gx = Math.max(0, (cxm - minX) * invDx),
					gy = Math.max(0, (cym - minY) * invDy);
				let ix = gx | 0,
					iy = gy | 0;
				if (ix > LX - 2) ix = LX - 2;
				if (iy > LY - 2) iy = LY - 2;
				const tx = gx - ix,
					ty = gy - iy;
				const o = (iy * LX + ix) * 3,
					o2 = o + LX * 3;
				let wx = lat[o] + (lat[o + 3] - lat[o]) * tx;
				let wy = lat[o + 1] + (lat[o + 4] - lat[o + 1]) * tx;
				let wz = lat[o + 2] + (lat[o + 5] - lat[o + 2]) * tx;
				wx += (lat[o2] + (lat[o2 + 3] - lat[o2]) * tx - wx) * ty;
				wy += (lat[o2 + 1] + (lat[o2 + 4] - lat[o2 + 1]) * tx - wy) * ty;
				wz += (lat[o2 + 2] + (lat[o2 + 5] - lat[o2 + 2]) * tx - wz) * ty;
				if (jet && wind) {
					wind.jet(cxm, cym, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3, wtmp);
					wx += wtmp[0];
					wy += wtmp[1];
					wz += wtmp[2];
				}
				const rx = wx - (vel[a] + vel[b] + vel[c]) / 3,
					ry = wy - (vel[a + 1] + vel[b + 1] + vel[c + 1]) / 3,
					rz = wz - (vel[a + 2] + vel[b + 2] + vel[c + 2]) / 3;
				// pressure on the face: proportional to the wind hitting it square-on
				const vn = (rx * nx + ry * ny + rz * nz) / a2;
				const f = (k * vn * 0.5) / 3;
				const fx = nx * f,
					fy = ny * f,
					fz = nz * f;
				const ia = im[tri[t * 3]],
					ib = im[tri[t * 3 + 1]],
					ic = im[tri[t * 3 + 2]];
				acc[a] += fx * ia;
				acc[a + 1] += fy * ia;
				acc[a + 2] += fz * ia;
				acc[b] += fx * ib;
				acc[b + 1] += fy * ib;
				acc[b + 2] += fz * ib;
				acc[c] += fx * ic;
				acc[c + 1] += fy * ic;
				acc[c + 2] += fz * ic;
			}
		}
		for (let p = 0; p < np; p++) {
			const i = p * 3;
			const l = Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]);
			if (l > 1e-12) {
				nrm[i] /= l;
				nrm[i + 1] /= l;
				nrm[i + 2] /= l;
			} else {
				nrm[i] = 0;
				nrm[i + 1] = 0;
				nrm[i + 2] = 1;
			}
			// keep runaway gusts from flinging light cloth into orbit
			const ax = acc[i],
				ay = acc[i + 1],
				az = acc[i + 2];
			const a2 = ax * ax + ay * ay + az * az;
			if (a2 > 900) {
				const s = 30 / Math.sqrt(a2);
				acc[i] = ax * s;
				acc[i + 1] = ay * s;
				acc[i + 2] = az * s;
			}
		}
	}

	/** Advance one fixed substep. */
	substep() {
		const dt = DT;
		const { pos, prev, vel, acc, im, alive } = this;
		const np = this.np;
		const g = this.gravity;
		const damp = Math.exp(-this.fabric.damping * dt);
		this.time += dt;
		this.stepN++;

		// integrate
		for (let p = 0, i = 0; p < np; p++, i += 3) {
			if (!alive[p]) continue;
			if (im[p] === 0) {
				prev[i] = pos[i];
				prev[i + 1] = pos[i + 1];
				prev[i + 2] = pos[i + 2];
				vel[i] = vel[i + 1] = vel[i + 2] = 0;
				continue;
			}
			let vx = (vel[i] + acc[i] * dt) * damp,
				vy = (vel[i + 1] + (acc[i + 1] + g) * dt) * damp,
				vz = (vel[i + 2] + acc[i + 2] * dt) * damp;
			const s2 = vx * vx + vy * vy + vz * vz;
			if (s2 > 400) {
				const s = 20 / Math.sqrt(s2);
				vx *= s;
				vy *= s;
				vz *= s;
			}
			prev[i] = pos[i];
			prev[i + 1] = pos[i + 1];
			prev[i + 2] = pos[i + 2];
			pos[i] += vx * dt;
			pos[i + 1] += vy * dt;
			pos[i + 2] += vz * dt;
		}

		// hands: a strong but finite pull toward the pointer
		for (let gi = 0; gi < this.grabs.length; gi++) {
			const gr = this.grabs[gi];
			let far = 0;
			for (let k = 0; k < gr.n; k++) {
				const p = gr.idx[k];
				if (!alive[p] || im[p] === 0) continue;
				const i = p * 3;
				const wg = gr.wgt[k];
				let dx = gr.tx + gr.off[k * 3] - pos[i],
					dy = gr.ty + gr.off[k * 3 + 1] - pos[i + 1],
					dz = gr.tz + gr.off[k * 3 + 2] - pos[i + 2];
				const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
				if (d > far) far = d;
				if (d < 1e-7) continue;
				// a light tug is gentle; hauling the pointer far past the cloth is a real yank
				const ramp = d > 0.25 ? 1 : 0.35 + d * 2.6;
				const maxc = this.handForce * ramp * im[p] * dt * dt * wg;
				let c = d * 0.5 * wg;
				if (c > maxc) c = maxc;
				c /= d;
				dx *= c;
				dy *= c;
				dz *= c;
				pos[i] += dx;
				pos[i + 1] += dy;
				pos[i + 2] += dz;
			}
			gr.strain = far;
		}

		// distance + bending constraints, one Gauss-Seidel sweep
		const { ea, eb, eRest, eAlive, eO0, eO1, eBend } = this;
		const aS = this.fabric.stretch / (dt * dt);
		// bending is solved on alternate steps (at double strength): folds need less precision
		// than stretch does, and skipping takes a quarter off the work of the solver
		const aB = (this.fabric.bend * 0.5) / (dt * dt);
		const bend = this.bendOn && (this.stepN & 1) === 0;
		const ne = this.ne;
		for (let e = 0; e < ne; e++) {
			if (!eAlive[e]) continue;
			const pa = ea[e],
				pb = eb[e];
			const a = pa * 3,
				b = pb * 3;
			const wa = im[pa],
				wb = im[pb];
			const dx = pos[b] - pos[a],
				dy = pos[b + 1] - pos[a + 1],
				dz = pos[b + 2] - pos[a + 2];
			const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
			const rest = eRest[e];
			const ws = wa + wb;
			if (ws > 0 && len > 1e-9) {
				const s = (len - rest) / (len * (ws + aS));
				const sa = s * wa,
					sb = s * wb;
				pos[a] += dx * sa;
				pos[a + 1] += dy * sa;
				pos[a + 2] += dz * sa;
				pos[b] -= dx * sb;
				pos[b + 1] -= dy * sb;
				pos[b + 2] -= dz * sb;
			}
			if (bend) {
				const br = eBend[e];
				if (br > 0) {
					const o0 = eO0[e],
						o1 = eO1[e];
					const w0 = im[o0],
						w1 = im[o1];
					const wsb = w0 + w1;
					if (wsb > 0) {
						const c = o0 * 3,
							d = o1 * 3;
						const bx = pos[d] - pos[c],
							by = pos[d + 1] - pos[c + 1],
							bz = pos[d + 2] - pos[c + 2];
						const bl = Math.sqrt(bx * bx + by * by + bz * bz);
						if (bl > 1e-9) {
							const s = (bl - br) / (bl * (wsb + aB));
							const s0 = s * w0,
								s1 = s * w1;
							pos[c] += bx * s0;
							pos[c + 1] += by * s0;
							pos[c + 2] += bz * s0;
							pos[d] -= bx * s1;
							pos[d + 1] -= by * s1;
							pos[d + 2] -= bz * s1;
						}
					}
				}
			}
		}

		this.collide();

		// velocities from the corrected positions
		const inv = 1 / dt;
		for (let p = 0, i = 0; p < np; p++, i += 3) {
			if (!alive[p] || im[p] === 0) continue;
			vel[i] = (pos[i] - prev[i]) * inv;
			vel[i + 1] = (pos[i + 1] - prev[i + 1]) * inv;
			vel[i + 2] = (pos[i + 2] - prev[i + 2]) * inv;
		}

		// Cloth only rips because of something done to it: while a hand is pulling, or for a
		// moment after a cut, a blast, a burn or another rip. Wind and weight alone never start one.
		if (this.gate > 0) this.gate -= dt;
		if (this.tearOn && this.stepN % TEAR_EVERY === 0 && (this.gate > 0 || this.grabs.length > 0))
			this.tearPass();
	}

	/**
	 * Find the most overstretched edges on the settled positions and rip them.
	 * Only a handful go per pass, worst first, so a tear runs across the cloth instead of popping.
	 */
	private tearPass() {
		const { pos, ea, eb, eRest, eThr, eDmg, eAlive, wet } = this;
		const wetWeak = this.anyWet ? this.fabric.wetWeak : 0;
		const preK = (1 - wetWeak) * 0.8;
		const fatigue = TEAR_EVERY * DT * 0.35 * (0.5 + this.fabric.rip);
		const cand = this.cand,
			candR = this.candR;
		const K = 6;
		let n = 0;
		const anywhere = this.gate > 0;
		for (let e = 0; e < this.ne; e++) {
			if (!eAlive[e]) continue;
			const limEx = (eThr[e] - 1) * eDmg[e];
			const a = ea[e] * 3,
				b = eb[e] * 3;
			const dx = pos[b] - pos[a],
				dy = pos[b + 1] - pos[a + 1],
				dz = pos[b + 2] - pos[a + 2];
			const d2 = dx * dx + dy * dy + dz * dz;
			const pre = eRest[e] * (1 + limEx * preK);
			if (d2 < pre * pre) continue;
			const ex = Math.sqrt(d2) / eRest[e] - 1;
			const lim = limEx * (1 - wetWeak * 0.5 * (wet[ea[e]] + wet[eb[e]]));
			if (ex > lim) {
				// a pull only starts rips within reach of the hand doing the pulling
				if (!anywhere && !this.nearHand(a)) continue;
				// keep the K worst offenders, sorted
				const r = ex / lim;
				let k: number;
				if (n < K) k = n++;
				else if (r > candR[K - 1]) k = K - 1;
				else continue;
				while (k > 0 && candR[k - 1] < r) {
					cand[k] = cand[k - 1];
					candR[k] = candR[k - 1];
					k--;
				}
				cand[k] = e;
				candR[k] = r;
			} else if (ex > lim * 0.8 && eDmg[e] > 0.3) {
				// fatigue: fibres held near their limit slowly give up
				eDmg[e] -= fatigue;
			}
		}
		for (let k = 0; k < n; k++) {
			const e = cand[k];
			if (!eAlive[e]) continue;
			const a = ea[e] * 3,
				b = eb[e] * 3;
			const len = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
			const ex = len / eRest[e] - 1;
			// an earlier rip this pass may already have let it relax
			if (ex > (eThr[e] - 1) * eDmg[e] * (1 - wetWeak)) this.tearEdge(e, clamp(ex, 0, 3));
		}
	}

	/** Is the particle at array offset i within reach of a hand holding the cloth? */
	private nearHand(i: number): boolean {
		const pos = this.pos;
		const x = pos[i],
			y = pos[i + 1],
			z = pos[i + 2];
		for (let g = 0; g < this.grabs.length; g++) {
			const q = this.grabs[g].idx[0] * 3;
			const dx = pos[q] - x,
				dy = pos[q + 1] - y,
				dz = pos[q + 2] - z;
			if (dx * dx + dy * dy + dz * dz < HAND_REACH2) return true;
		}
		return false;
	}

	private collide() {
		const { pos, prev, im, alive, floorOff } = this;
		const np = this.np;
		const fy = this.floorY;
		const wz = this.wallZ + 0.012;
		const mu = this.fabric.friction;
		const keepF = 1 - mu * 0.12;
		const cols = this.colliders;
		const nc = cols.length;
		for (let p = 0, i = 0; p < np; p++, i += 3) {
			if (!alive[p] || im[p] === 0) continue;
			const floor = fy + floorOff[p];
			if (pos[i + 1] < floor) {
				const vy = pos[i + 1] - prev[i + 1];
				pos[i + 1] = floor;
				// friction: cloth on the ground mostly stays where it lands
				pos[i] = prev[i] + (pos[i] - prev[i]) * keepF;
				pos[i + 2] = prev[i + 2] + (pos[i + 2] - prev[i + 2]) * keepF;
				if (vy < -0.004) {
					const sp = -vy * 480;
					this.impactN++;
					if (sp > this.impactV) {
						this.impactV = sp;
						this.impactX = pos[i];
						this.impactZ = pos[i + 2];
					}
				}
			}
			if (pos[i + 2] < wz) {
				pos[i + 2] = wz;
				pos[i] = prev[i] + (pos[i] - prev[i]) * 0.94;
				pos[i + 1] = prev[i + 1] + (pos[i + 1] - prev[i + 1]) * 0.94;
			}
			for (let c = 0; c < nc; c++) {
				const col = cols[c];
				let nx = 0,
					ny = 0,
					nz = 0,
					push = 0;
				const dx = pos[i] - col.x,
					dy = pos[i + 1] - col.y,
					dz = pos[i + 2] - col.z;
				if (col.kind === "sphere") {
					const r = col.r + 0.008;
					const d2 = dx * dx + dy * dy + dz * dz;
					if (d2 >= r * r || d2 < 1e-12) continue;
					const d = Math.sqrt(d2);
					nx = dx / d;
					ny = dy / d;
					nz = dz / d;
					push = r - d;
				} else {
					const px = col.hx + 0.008 - Math.abs(dx),
						py = col.hy + 0.008 - Math.abs(dy),
						pz = col.hz + 0.008 - Math.abs(dz);
					if (px <= 0 || py <= 0 || pz <= 0) continue;
					if (px < py && px < pz) {
						nx = dx > 0 ? 1 : -1;
						push = px;
					} else if (py < pz) {
						ny = dy > 0 ? 1 : -1;
						push = py;
					} else {
						nz = dz > 0 ? 1 : -1;
						push = pz;
					}
				}
				// displacement this step, with the part driving into the surface removed
				let mx = pos[i] - prev[i],
					my = pos[i + 1] - prev[i + 1],
					mz = pos[i + 2] - prev[i + 2];
				const into = mx * nx + my * ny + mz * nz;
				if (into < 0) {
					mx -= nx * into;
					my -= ny * into;
					mz -= nz * into;
				}
				const keep = 1 - mu * 0.1;
				pos[i] += nx * push;
				pos[i + 1] += ny * push;
				pos[i + 2] += nz * push;
				prev[i] = pos[i] - mx * keep;
				prev[i + 1] = pos[i + 1] - my * keep;
				prev[i + 2] = pos[i + 2] - mz * keep;
			}
		}
	}

	/** Fire, soaking, drying. Call once per frame. */
	updateState(dt: number) {
		const f = this.fabric;
		const { alive, burning, burn, heat, wet, fan, fanN, tri, pos } = this;
		const np = this.np;
		let nBurning = 0;
		let anyHeat = false;
		let needMass = false;
		const flam = f.flammability;
		const rate = dt / f.charTime;
		const sp = this.spacing;
		for (let v = 0; v < np; v++) {
			if (!alive[v]) continue;
			if (wet[v] > 0) {
				wet[v] -= dt * 0.018;
				if (wet[v] <= 0) {
					wet[v] = 0;
					needMass = true;
				}
			}
			if (burning[v]) {
				if (wet[v] > 0.35) {
					burning[v] = 0;
					heat[v] = 0;
					this.pushEvent(EV_STEAM, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], 0, 1, 0, 1);
					continue;
				}
				nBurning++;
				burn[v] += rate * (0.75 + hash01(v) * 0.5);
				if (burn[v] > 0.08) {
					const base = v * MAX_FAN;
					const vy = pos[v * 3 + 1];
					for (let k = 0; k < fanN[v]; k++) {
						const T = fan[base + k];
						for (let j = 0; j < 3; j++) {
							const u = tri[T * 3 + j];
							if (u === v || burning[u] || burn[u] > 0) continue;
							// flames climb: cloth above the fire catches far sooner than cloth below
							const up = clamp((pos[u * 3 + 1] - vy) / sp, -0.7, 1);
							const dry = 1 - Math.min(1, wet[u] * 3);
							heat[u] += dt * flam * 1.6 * (1 + 0.85 * up) * dry;
							if (heat[u] >= 1) {
								burning[u] = 1;
								burn[u] = 0.001;
							}
						}
					}
				}
				if (burn[v] >= 1) {
					burn[v] = 1;
					burning[v] = 0;
					this.charCheck(v);
				}
			} else if (heat[v] > 0 && burn[v] === 0) {
				heat[v] -= dt * 0.45;
				if (heat[v] < 0) heat[v] = 0;
				else anyHeat = true;
			}
		}
		this.nBurning = nBurning;
		this.anyHeat = anyHeat || nBurning > 0;
		if (needMass || this.anyWet) this.refreshMass();
	}

	/** Remove triangles around v that have burnt through. */
	private charCheck(v: number) {
		const base = v * MAX_FAN;
		let n = 0;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			const b0 = this.burn[this.tri[T * 3]],
				b1 = this.burn[this.tri[T * 3 + 1]],
				b2 = this.burn[this.tri[T * 3 + 2]];
			const full = (b0 >= 1 ? 1 : 0) + (b1 >= 1 ? 1 : 0) + (b2 >= 1 ? 1 : 0);
			const mn = Math.min(b0, b1, b2);
			if (full === 3 || (full === 2 && mn > 0.55)) ft[n++] = T;
		}
		const px = this.pos[v * 3],
			py = this.pos[v * 3 + 1],
			pz = this.pos[v * 3 + 2];
		for (let k = 0; k < n; k++) {
			const T = ft[k];
			this.burntArea += this.triArea[T];
			this.killTri(T, 0);
		}
		if (n) {
			this.pushEvent(EV_BURN, px, py, pz, 0, 1, 0, n);
			if (this.gate < 0.6) this.gate = 0.6;
		}
	}

	// ════════════════════════════════════════════════════════════
	//  interaction
	// ════════════════════════════════════════════════════════════

	/** Project every particle to screen pixels (for screen-space tools). */
	project(vp: Float32Array, w: number, h: number) {
		const { pos, scr, alive } = this;
		for (let p = 0, i = 0; p < this.np; p++, i += 3) {
			if (!alive[p]) continue;
			const x = pos[i],
				y = pos[i + 1],
				z = pos[i + 2];
			const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
			const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
			const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
			scr[p * 2] = (cx / cw + 1) * 0.5 * w;
			scr[p * 2 + 1] = (1 - cy / cw) * 0.5 * h;
		}
	}

	/** Nearest ray hit against the cloth. Returns distance along the ray or -1; hit triangle in `hitTri`. */
	hitTri = -1;
	raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
		const { pos, tri, triAlive } = this;
		let best = -1;
		this.hitTri = -1;
		for (let t = 0; t < this.nt; t++) {
			if (!triAlive[t]) continue;
			const a = tri[t * 3] * 3,
				b = tri[t * 3 + 1] * 3,
				c = tri[t * 3 + 2] * 3;
			const e1x = pos[b] - pos[a],
				e1y = pos[b + 1] - pos[a + 1],
				e1z = pos[b + 2] - pos[a + 2];
			const e2x = pos[c] - pos[a],
				e2y = pos[c + 1] - pos[a + 1],
				e2z = pos[c + 2] - pos[a + 2];
			const px = dy * e2z - dz * e2y,
				py = dz * e2x - dx * e2z,
				pz = dx * e2y - dy * e2x;
			const det = e1x * px + e1y * py + e1z * pz;
			if (det > -1e-12 && det < 1e-12) continue;
			const inv = 1 / det;
			const tx = ox - pos[a],
				ty = oy - pos[a + 1],
				tz = oz - pos[a + 2];
			const u = (tx * px + ty * py + tz * pz) * inv;
			if (u < 0 || u > 1) continue;
			const qx = ty * e1z - tz * e1y,
				qy = tz * e1x - tx * e1z,
				qz = tx * e1y - ty * e1x;
			const v = (dx * qx + dy * qy + dz * qz) * inv;
			if (v < 0 || u + v > 1) continue;
			const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
			if (d > 1e-5 && (best < 0 || d < best)) {
				best = d;
				this.hitTri = t;
			}
		}
		return best;
	}

	/** Nearest live particle to a screen point, within maxR pixels. */
	pickScreen(x: number, y: number, maxR: number): number {
		const { scr, alive } = this;
		let best = -1,
			bd = maxR * maxR;
		for (let p = 0; p < this.np; p++) {
			if (!alive[p]) continue;
			const dx = scr[p * 2] - x,
				dy = scr[p * 2 + 1] - y;
			const d = dx * dx + dy * dy;
			if (d < bd) {
				bd = d;
				best = p;
			}
		}
		return best;
	}

	/** Take hold of the cloth around a world point. */
	grab(x: number, y: number, z: number, radius: number): Grab | null {
		const { pos, alive, pin } = this;
		const g: Grab = {
			n: 0,
			idx: new Int32Array(GRAB_CAP),
			wgt: new Float32Array(GRAB_CAP),
			off: new Float32Array(GRAB_CAP * 3),
			tx: x,
			ty: y,
			tz: z,
			strain: 0,
		};
		const r2 = radius * radius;
		for (let p = 0, i = 0; p < this.np && g.n < GRAB_CAP; p++, i += 3) {
			if (!alive[p] || pin[p]) continue;
			const dx = pos[i] - x,
				dy = pos[i + 1] - y,
				dz = pos[i + 2] - z;
			const d2 = dx * dx + dy * dy + dz * dz;
			if (d2 > r2) continue;
			const k = g.n++;
			const f = 1 - Math.sqrt(d2) / radius;
			g.idx[k] = p;
			g.wgt[k] = 0.25 + 0.75 * f;
			g.off[k * 3] = dx;
			g.off[k * 3 + 1] = dy;
			g.off[k * 3 + 2] = dz;
		}
		if (g.n === 0) return null;
		this.grabs.push(g);
		return g;
	}

	release(g: Grab) {
		const i = this.grabs.indexOf(g);
		if (i >= 0) this.grabs.splice(i, 1);
	}

	/** Start a new cutting stroke (scissors / blade). */
	beginStroke() {
		this.stroke.fill(0, 0, this.np);
		this.strokeLast = -1;
	}

	/**
	 * Cut along a screen-space segment. Mesh vertices are slid onto the blade's path so
	 * the cut is straight at any angle rather than a zig-zag along the grid.
	 * Requires project() to have been called. Returns edges severed.
	 */
	cutSegment(x0: number, y0: number, x1: number, y1: number, frayAmt: number): number {
		const { scr, ea, eb, eAlive, stroke } = this;
		const dx = x1 - x0,
			dy = y1 - y0;
		const len2 = dx * dx + dy * dy;
		if (len2 < 1e-6) return 0;
		const minx = Math.min(x0, x1),
			maxx = Math.max(x0, x1),
			miny = Math.min(y0, y1),
			maxy = Math.max(y0, y1);

		// 1. every edge the blade crosses, ordered along the stroke
		const hits: number[] = [];
		const hitT: number[] = [];
		for (let e = 0; e < this.ne; e++) {
			if (!eAlive[e]) continue;
			const a = ea[e] * 2,
				b = eb[e] * 2;
			const ax = scr[a],
				ay = scr[a + 1],
				bx = scr[b],
				by = scr[b + 1];
			if ((ax < minx && bx < minx) || (ax > maxx && bx > maxx)) continue;
			if ((ay < miny && by < miny) || (ay > maxy && by > maxy)) continue;
			const t = this.crossT(x0, y0, dx, dy, ax, ay, bx, by);
			if (t >= 0) {
				hits.push(e);
				hitT.push(t);
			}
		}
		if (hits.length === 0) return 0;
		const order = hits.map((_, i) => i).sort((p, q) => hitT[p] - hitT[q]);

		// 2. walk the crossings; pull the nearer end of each edge onto the blade
		const flagged: number[] = [];
		for (const oi of order) {
			const e = hits[oi];
			if (!eAlive[e]) continue;
			const pa = ea[e],
				pb = eb[e];
			const ax = scr[pa * 2],
				ay = scr[pa * 2 + 1],
				bx = scr[pb * 2],
				by = scr[pb * 2 + 1];
			const t = this.crossT(x0, y0, dx, dy, ax, ay, bx, by);
			if (t < 0) continue; // an earlier slide already moved this edge off the blade
			const s = this.crossS;
			const near = s < 0.5 ? pa : pb,
				farV = s < 0.5 ? pb : pa;
			let v = -1;
			// the blade runs (near enough) through a mesh point already: use it as is
			if (s < 0.03 || s > 0.97) v = near;
			else if (this.slide(near, e, pa, pb, s)) v = near;
			else if (this.slide(farV, e, pa, pb, s)) v = farV;
			else v = stroke[farV] && !stroke[near] ? farV : near; // can't move it — follow the grid here
			if (!stroke[v] || flagged.indexOf(v) < 0) {
				stroke[v] = 1;
				if (flagged.indexOf(v) < 0) flagged.push(v);
			}
		}
		// order the path by where each point actually sits along the blade
		const along = (v: number) => ((scr[v * 2] - x0) * dx + (scr[v * 2 + 1] - y0) * dy) / len2;
		flagged.sort((p, q) => along(p) - along(q));
		const path: number[] = [];
		if (this.strokeLast >= 0 && this.alive[this.strokeLast] && flagged[0] !== this.strokeLast)
			path.push(this.strokeLast);
		for (const v of flagged) path.push(v);

		// 3. sever the edges joining consecutive points on the path
		let cut = 0;
		for (let k = 1; k < path.length; k++) {
			const e = this.findEdge(path[k - 1], path[k]);
			if (e >= 0 && !this.eCut[e] && this.eT1[e] >= 0) {
				this.eCut[e] = 1;
				cut++;
				const a = ea[e] * 3,
					b = eb[e] * 3;
				const pos = this.pos;
				this.pushEvent(
					EV_CUT,
					(pos[a] + pos[b]) / 2,
					(pos[a + 1] + pos[b + 1]) / 2,
					(pos[a + 2] + pos[b + 2]) / 2,
					pos[b] - pos[a],
					pos[b + 1] - pos[a + 1],
					pos[b + 2] - pos[a + 2],
					1,
				);
			}
		}
		// 4. let the fans fall apart along the severed edges
		for (let k = 0; k < path.length; k++) {
			const v = path[k];
			if (this.alive[v]) {
				const made = this.splitComponents(v, frayAmt);
				// keep following whichever copy is still on the stroke
				if (made && k === path.length - 1) stroke[v] = 1;
			}
		}
		if (path.length) this.strokeLast = path[path.length - 1];
		this.cutCount += cut;
		if (cut && this.gate < 1) this.gate = 1;
		return cut;
	}

	private crossS = 0;
	/** Proper intersection of stroke (p, d) with segment ab → t along stroke, or -1. Sets crossS. */
	private crossT(
		x0: number,
		y0: number,
		dx: number,
		dy: number,
		ax: number,
		ay: number,
		bx: number,
		by: number,
	) {
		const ex = bx - ax,
			ey = by - ay;
		const den = dx * ey - dy * ex;
		if (den > -1e-9 && den < 1e-9) return -1;
		const t = ((ax - x0) * ey - (ay - y0) * ex) / den;
		const s = ((ax - x0) * dy - (ay - y0) * dx) / den;
		if (t < 0 || t > 1 || s < -1e-4 || s > 1.0001) return -1;
		this.crossS = s;
		return t;
	}

	/** Slide particle v along edge (pa,pb) to parameter s, if the surrounding mesh stays healthy. */
	private slide(v: number, e: number, pa: number, pb: number, s: number): boolean {
		if (this.pin[v] || this.stroke[v]) return false;
		// border particles may only travel along their own border
		if (this.eT1[e] >= 0 && this.isBorder(v)) return false;
		const uv = this.uv;
		const nu = uv[pa * 2] + (uv[pb * 2] - uv[pa * 2]) * s,
			nv = uv[pa * 2 + 1] + (uv[pb * 2 + 1] - uv[pa * 2 + 1]) * s;
		// would any triangle collapse or flip?
		const base = v * MAX_FAN;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			const kv = this.localIndex(T, v);
			const q = this.tri[T * 3 + ((kv + 1) % 3)],
				r = this.tri[T * 3 + ((kv + 2) % 3)];
			const before = this.uvArea(
				uv[v * 2],
				uv[v * 2 + 1],
				uv[q * 2],
				uv[q * 2 + 1],
				uv[r * 2],
				uv[r * 2 + 1],
			);
			const after = this.uvArea(nu, nv, uv[q * 2], uv[q * 2 + 1], uv[r * 2], uv[r * 2 + 1]);
			// the two triangles on the edge itself are allowed to shrink; the rest must stay sound
			const onEdge = q === pa || q === pb || r === pa || r === pb;
			const minKeep = onEdge ? 0.12 : 0.3;
			if (after * before <= 0 || Math.abs(after) < Math.abs(before) * minKeep) return false;
		}
		uv[v * 2] = nu;
		uv[v * 2 + 1] = nv;
		const a3 = pa * 3,
			b3 = pb * 3,
			v3 = v * 3;
		const { pos, prev, vel, scr } = this;
		for (let k = 0; k < 3; k++) {
			const np = pos[a3 + k] + (pos[b3 + k] - pos[a3 + k]) * s;
			const nq = prev[a3 + k] + (prev[b3 + k] - prev[a3 + k]) * s;
			const nvl = vel[a3 + k] + (vel[b3 + k] - vel[a3 + k]) * s;
			pos[v3 + k] = np;
			prev[v3 + k] = nq;
			vel[v3 + k] = nvl;
		}
		const sx = scr[pa * 2] + (scr[pb * 2] - scr[pa * 2]) * s,
			sy = scr[pa * 2 + 1] + (scr[pb * 2 + 1] - scr[pa * 2 + 1]) * s;
		scr[v * 2] = sx;
		scr[v * 2 + 1] = sy;
		this.refreshAround(v);
		this.uvVersion++;
		return true;
	}

	/** Live edge joining a and b, or -1. */
	private findEdge(a: number, b: number): number {
		const base = a * MAX_FAN;
		for (let k = 0; k < this.fanN[a]; k++) {
			const T = this.fan[base + k];
			for (let j = 0; j < 3; j++) {
				const e = this.triE[T * 3 + j];
				if ((this.ea[e] === a && this.eb[e] === b) || (this.ea[e] === b && this.eb[e] === a))
					return e;
			}
		}
		return -1;
	}

	/** Toggle a pin on particle p. Returns the new pin state. */
	togglePin(p: number): number {
		if (!this.alive[p]) return PIN_NONE;
		if (this.pin[p]) {
			this.pin[p] = PIN_NONE;
			this.im[p] = this.w0[p] / (1 + this.wet[p] * 1.4);
		} else {
			this.pin[p] = PIN_USER;
			this.im[p] = 0;
		}
		return this.pin[p];
	}

	/** Heat (and eventually ignite) cloth inside a screen-space circle. Returns particles newly lit. */
	heatAt(x: number, y: number, r: number, amount: number): number {
		const { scr, alive, burning, burn, heat, wet } = this;
		const flam = this.fabric.flammability;
		const r2 = r * r;
		let lit = 0;
		for (let p = 0; p < this.np; p++) {
			if (!alive[p] || burning[p] || burn[p] > 0) continue;
			const dx = scr[p * 2] - x,
				dy = scr[p * 2 + 1] - y;
			const d2 = dx * dx + dy * dy;
			if (d2 > r2) continue;
			if (wet[p] > 0.3) {
				wet[p] = Math.max(0, wet[p] - amount * 0.25);
				continue;
			}
			const f = 1 - d2 / r2;
			if (flam <= 0) {
				heat[p] = Math.min(1, heat[p] + amount * f * 0.8);
			} else {
				heat[p] += amount * f * (0.4 + flam);
				if (heat[p] >= 1) {
					burning[p] = 1;
					burn[p] = 0.001;
					lit++;
				}
			}
			this.anyHeat = true;
		}
		return lit;
	}

	/** Soak cloth inside a screen-space circle. Returns flames put out. */
	wetAt(x: number, y: number, r: number, amount: number): number {
		const { scr, alive, wet, burning } = this;
		const r2 = r * r;
		let out = 0;
		for (let p = 0; p < this.np; p++) {
			if (!alive[p]) continue;
			const dx = scr[p * 2] - x,
				dy = scr[p * 2 + 1] - y;
			const d2 = dx * dx + dy * dy;
			if (d2 > r2) continue;
			wet[p] = Math.min(1, wet[p] + amount * (1 - d2 / r2));
			if (burning[p] && wet[p] > 0.35) out++;
		}
		this.anyWet = true;
		return out;
	}

	/**
	 * Stitch torn seams near a screen point: copies of the same original particle are
	 * drawn together and, once they meet, merged back into one. Returns merges made.
	 */
	sewAt(x: number, y: number, r: number): number {
		const { scr, alive, origin, pos } = this;
		const r2 = r * r;
		const seen = new Map<number, number>();
		let merged = 0;
		const mergeDist = this.spacing * 0.75;
		for (let p = 0; p < this.np; p++) {
			if (!alive[p]) continue;
			const dx = scr[p * 2] - x,
				dy = scr[p * 2 + 1] - y;
			if (dx * dx + dy * dy > r2) continue;
			const o = origin[p];
			const q = seen.get(o);
			if (q === undefined || !alive[q]) {
				seen.set(o, p);
				continue;
			}
			if (this.fanN[p] + this.fanN[q] > MAX_FAN) continue;
			const p3 = p * 3,
				q3 = q * 3;
			const ex = pos[p3] - pos[q3],
				ey = pos[p3 + 1] - pos[q3 + 1],
				ez = pos[p3 + 2] - pos[q3 + 2];
			const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
			if (d < mergeDist) {
				this.merge(q, p);
				merged++;
			} else if (d < this.spacing * 6) {
				// draw the two sides of the wound together
				const wp = this.im[p],
					wq = this.im[q];
				const ws = wp + wq;
				if (ws > 0) {
					const s = 0.22 / ws;
					pos[p3] -= ex * s * wp;
					pos[p3 + 1] -= ey * s * wp;
					pos[p3 + 2] -= ez * s * wp;
					pos[q3] += ex * s * wq;
					pos[q3 + 1] += ey * s * wq;
					pos[q3 + 2] += ez * s * wq;
				}
			}
		}
		return merged;
	}

	/** Merge particle v2 into v (both copies of the same original point). */
	private merge(v: number, v2: number) {
		const n = this.fanN[v2];
		const base2 = v2 * MAX_FAN;
		for (let k = 0; k < n; k++) ft[k] = this.fan[base2 + k];
		for (let k = 0; k < n; k++) {
			const T = ft[k];
			const kv = this.localIndex(T, v2);
			this.tri[T * 3 + kv] = v;
			for (let s = 0; s < 2; s++) {
				const le = s === 0 ? kv : (kv + 2) % 3;
				const e = this.triE[T * 3 + le];
				const wv = this.ea[e] === v2 ? this.eb[e] : this.ea[e] === v ? this.eb[e] : this.ea[e];
				const e1 = this.findEdge(v, wv);
				if (e1 >= 0 && e1 !== e && this.eT1[e1] < 0 && this.eT1[e] < 0) {
					// the two lips of the wound become one interior edge again
					this.eT1[e1] = T;
					this.eO1[e1] = this.eO0[e];
					this.eCut[e1] = 0;
					this.eDmg[e1] = Math.max(this.eDmg[e1], 0.85);
					this.triE[T * 3 + le] = e1;
					this.killEdge(e);
				} else {
					if (this.ea[e] === v2) this.ea[e] = v;
					else if (this.eb[e] === v2) this.eb[e] = v;
				}
			}
			const eo = this.triE[T * 3 + ((kv + 1) % 3)];
			if (this.eT0[eo] === T) this.eO0[eo] = v;
			else if (this.eT1[eo] === T) this.eO1[eo] = v;
			this.fan[v * MAX_FAN + this.fanN[v]++] = T;
		}
		const a = v * 3,
			b = v2 * 3;
		for (let k = 0; k < 3; k++) {
			this.pos[a + k] = (this.pos[a + k] + this.pos[b + k]) / 2;
			this.prev[a + k] = (this.prev[a + k] + this.prev[b + k]) / 2;
			this.vel[a + k] = (this.vel[a + k] + this.vel[b + k]) / 2;
		}
		if (this.pin[v2] && !this.pin[v]) {
			this.pin[v] = this.pin[v2];
			this.im[v] = 0;
		}
		this.seam[v] = 1;
		this.fray[v] = 0;
		this.fanN[v2] = 0;
		this.killParticle(v2);
		this.refreshAround(v);
		// neighbours' seams read better if they fade in together
		const base = v * MAX_FAN;
		for (let k = 0; k < this.fanN[v]; k++) {
			const T = this.fan[base + k];
			for (let j = 0; j < 3; j++) {
				const u = this.tri[T * 3 + j];
				if (this.fray[u] > 0.3) this.fray[u] = 0.3;
			}
		}
		this.topoVersion++;
	}

	/** A blast: vaporise the core, shred and scorch around it, and throw everything outward. */
	explode(x: number, y: number, z: number, radius: number, power: number) {
		const { pos, vel, alive, im } = this;
		const r2 = radius * radius;
		const core = radius * 0.3;
		this.gate = Math.max(this.gate, 1.5);
		// kill triangles in the core
		for (let t = 0; t < this.nt; t++) {
			if (!this.triAlive[t]) continue;
			const a = this.tri[t * 3] * 3,
				b = this.tri[t * 3 + 1] * 3,
				c = this.tri[t * 3 + 2] * 3;
			const cx = (pos[a] + pos[b] + pos[c]) / 3 - x,
				cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - y,
				cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - z;
			if (cx * cx + cy * cy + cz * cz < core * core && this.fabric.strength < 30000) {
				this.burntArea += this.triArea[t];
				this.killTri(t, 1);
			}
		}
		const flam = this.fabric.flammability;
		for (let p = 0, i = 0; p < this.np; p++, i += 3) {
			if (!alive[p]) continue;
			const dx = pos[i] - x,
				dy = pos[i + 1] - y,
				dz = pos[i + 2] - z;
			const d2 = dx * dx + dy * dy + dz * dz;
			if (d2 > r2) continue;
			const d = Math.sqrt(d2) || 1e-4;
			const f = 1 - d / radius;
			if (im[p] > 0) {
				const k = (power * f * f * im[p]) / d;
				vel[i] += dx * k;
				vel[i + 1] += dy * k + power * f * 0.15 * im[p];
				vel[i + 2] += dz * k - power * f * f * 0.5 * im[p];
			}
			if (f > 0.35) {
				this.weakenAround(p, 1 - f * 0.9);
				if (this.fray[p] < f) this.fray[p] = f;
			}
			if (flam > 0 && f > 0.45 && this.wet[p] < 0.3 && !this.burning[p] && this.burn[p] === 0) {
				this.heat[p] += f * 1.2 * (0.3 + flam);
				if (this.heat[p] >= 1) {
					this.burning[p] = 1;
					this.burn[p] = 0.001;
				}
			} else if (f > 0.3) {
				this.heat[p] = Math.min(1, this.heat[p] + f * 0.6);
			}
		}
		this.anyHeat = true;
	}

	/** Mark triangles whose centre satisfies `inside(u, v)` as the level's target region. */
	tagRegion(inside: (u: number, v: number) => boolean) {
		this.targetArea = 0;
		for (let t = 0; t < this.nt; t++) {
			const a = this.tri[t * 3],
				b = this.tri[t * 3 + 1],
				c = this.tri[t * 3 + 2];
			const u = (this.uv[a * 2] + this.uv[b * 2] + this.uv[c * 2]) / 3,
				v = (this.uv[a * 2 + 1] + this.uv[b * 2 + 1] + this.uv[c * 2 + 1]) / 3;
			if (inside(u, v)) {
				this.triTag[t] = 1;
				this.targetArea += this.triArea[t];
			} else this.triTag[t] = 0;
		}
	}

	// ════════════════════════════════════════════════════════════
	//  analysis
	// ════════════════════════════════════════════════════════════

	private find(p: number) {
		const parent = this.parent;
		let r = p;
		while (parent[r] !== r) r = parent[r];
		while (parent[p] !== r) {
			const n = parent[p];
			parent[p] = r;
			p = n;
		}
		return r;
	}

	/** Connected pieces, how much still hangs from a pin, how much survives. */
	analyze(minPieceArea = 0) {
		const { parent, compArea, compTag, compPin, alive } = this;
		const np = this.np;
		for (let p = 0; p < np; p++) {
			parent[p] = p;
			compArea[p] = 0;
			compTag[p] = 0;
			compPin[p] = 0;
		}
		for (let e = 0; e < this.ne; e++) {
			if (!this.eAlive[e]) continue;
			const a = this.find(this.ea[e]),
				b = this.find(this.eb[e]);
			if (a !== b) parent[b] = a;
		}
		let total = 0;
		for (let t = 0; t < this.nt; t++) {
			if (!this.triAlive[t]) continue;
			const r = this.find(this.tri[t * 3]);
			const ar = this.triArea[t];
			compArea[r] += ar;
			if (this.triTag[t]) compTag[r] += ar;
			total += ar;
		}
		for (let p = 0; p < np; p++) if (alive[p] && this.pin[p]) compPin[this.find(p)] = 1;
		const minA = minPieceArea || this.spacing * this.spacing * 3;
		let pieces = 0,
			hanging = 0;
		for (let p = 0; p < np; p++) {
			if (!alive[p] || parent[p] !== p) continue;
			if (compArea[p] >= minA) pieces++;
			if (compPin[p]) hanging += compArea[p];
		}
		this.pieces = Math.max(1, pieces);
		this.aliveArea = total;
		this.hangingArea = hanging;
	}

	/** Extra particle copies that sewing could still merge away. */
	countSplits() {
		let live = 0;
		const seen = new Set<number>();
		for (let p = 0; p < this.np; p++) {
			if (!this.alive[p]) continue;
			live++;
			seen.add(this.origin[p]);
		}
		return live - seen.size;
	}

	/** Run the solver for a while with nothing tearing, so a fresh cloth settles into its hang. */
	settle(seconds: number, wind: Wind | null) {
		const steps = Math.round(seconds / DT);
		const tear = this.tearOn;
		this.tearOn = false;
		for (let s = 0; s < steps; s++) {
			if (s % 8 === 0) this.prepare(wind);
			this.substep();
			// heavy damping while settling so it comes to rest quickly
			if (s < steps * 0.85) {
				const v = this.vel;
				for (let i = 0; i < this.np * 3; i++) v[i] *= 0.97;
			}
		}
		this.tearOn = tear;
		this.evN = 0;
		this.time = 0;
	}
}
