import * as sfx from "@/audio/sfx";
import { haptic } from "@/lib/haptics";
import { type Material, getMaterial } from "./materials";
import { TAU, clamp, lerp, rand } from "./math";
import type { ToolId } from "./tools";
import type { Constraint, GameStats, Milestone, Particle, PartyPayload, Tri } from "./types";

export type EngineCallbacks = {
	onStats?: (s: GameStats) => void;
	/** First tear / cut / burn per cloth — drives the tip ladder. */
	onMilestone?: (m: Milestone) => void;
	/** Party recap payload, or null when a fresh cloth closes it. */
	onParty?: (p: PartyPayload | null) => void;
	/** Fired once per cloth after IDLE_AFTER_S without input. */
	onIdle?: () => void;
};

const IDLE_AFTER_S = 20;
const GHOST_HINT_MAX_AGE_S = 12;

type Grab = { p: Particle; ox: number; oy: number; w: number; pri: boolean };

/** Verlet cloth engine — ported from rip-it-cloth-game.html. */
export class ClothEngine {
	cv: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	cb: EngineCallbacks;

	W = 0;
	H = 0;
	DPR = 1;
	floorY = 0;
	rodY = 52;

	bgCv: HTMLCanvasElement | null = null;
	vigCv: HTMLCanvasElement | null = null;
	glowSpr: HTMLCanvasElement | null = null;

	matId = "silk";
	mat: Material = getMaterial("silk");
	tool: ToolId = "hand";
	windAmp = 0.12;
	gravMul = 1;
	slowmo = false;

	time = 0;
	shake = 0;

	parts: Particle[] = [];
	cons: Constraint[] = [];
	adj: Constraint[][] = [];
	tris: Tri[] = [];
	cellCol: number[][] = [];
	cH: (Constraint | null)[] = [];
	cV: (Constraint | null)[] = [];
	cD: (Constraint | null)[] = [];
	cols = 0;
	rows = 0;
	S = 16;
	initStruct = 1;
	brokenStruct = 0;
	breaksTear = 0;
	thudAcc = 0;
	lastThud = 0;
	burningN = 0;
	lastBurningN = 0;
	stats = { fib: 0 };
	pieces = 1;
	frameN = 0;
	partyShown = false;
	firstTearFired = false;
	firstCutFired = false;
	firstBurnFired = false;
	idleFired = false;
	/** seconds; tip dismiss only after recent canvas input (AC-02) */
	lastInputAt = Number.NEGATIVE_INFINITY;
	/** hit-freeze seconds — micro pause that sells big rips */
	hitstop = 0;
	/** cloth fill-in ramp after build (0→1) */
	spawnT = 1;
	/** this.time at last buildCloth — drives ghost hint age + party seconds */
	builtAt = 0;

	ptr = { x: 0, y: 0, px: 0, py: 0, down: false, id: -1, vx: 0, vy: 0, lastT: 0 };
	grabList: Grab[] = [];
	fan = { on: false, x: 0, y: 0 };
	snipT = 0;
	lastSnipSnd = 0;
	lastCutX = 0;
	lastCutY = 0;
	lastFwoof = 0;

	fibers: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		l: number;
		life: number;
		t: number;
		c: number[];
		spark?: boolean;
	}> = [];
	embers: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		s: number;
		life: number;
		t: number;
	}> = [];
	smokes: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		s: number;
		life: number;
		t: number;
	}> = [];
	drops: Array<{ x: number; y: number; vx: number; vy: number; life: number; t: number }> = [];
	glints: Array<{ x: number; y: number; a: number; life: number; t: number }> = [];
	slashes: Array<{ x1: number; y1: number; x2: number; y2: number; life: number; t: number }> = [];
	stitches: Array<{ x: number; y: number; life: number; t: number }> = [];
	steams: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		s: number;
		life: number;
		t: number;
	}> = [];
	windStreaks: Array<{ x: number; y: number; l: number; a: number }> = [];

	private raf = 0;
	private last = 0;
	private acc = 0;
	private fpsAcc = 0;
	private fpsN = 0;
	private lastStats = 0;
	private disposed = false;
	private unbind: Array<() => void> = [];

	constructor(cv: HTMLCanvasElement, cb: EngineCallbacks = {}) {
		this.cv = cv;
		const ctx = cv.getContext("2d");
		if (!ctx) throw new Error("2d context unavailable");
		this.ctx = ctx;
		this.cb = cb;
		this.bindInput();
	}

	setTool(id: ToolId) {
		this.tool = id;
	}
	setWind(v: number) {
		this.windAmp = v;
	}
	setGravity(v: number) {
		this.gravMul = v;
	}
	setSlowmo(v: boolean) {
		this.slowmo = v;
	}
	setMuted(v: boolean) {
		sfx.setMuted(v);
	}
	freshCloth(matId?: string) {
		this.buildCloth(matId ?? this.matId);
	}

	mount(parent: HTMLElement) {
		this.sizeCanvas(parent);
		this.buildCloth(this.matId);
		this.last = performance.now();
		this.loop(this.last);
	}

	resize(parent: HTMLElement) {
		this.sizeCanvas(parent);
		this.buildCloth(this.matId);
	}

	dispose() {
		this.disposed = true;
		cancelAnimationFrame(this.raf);
		for (const u of this.unbind) u();
		this.unbind = [];
		sfx.stopSpray();
		sfx.stopFan();
	}

	private idx(i: number, j: number) {
		return j * (this.cols + 1) + i;
	}

	private sizeCanvas(parent: HTMLElement) {
		this.DPR = Math.min(2, window.devicePixelRatio || 1);
		this.W = parent.clientWidth || 800;
		this.H = parent.clientHeight || 600;
		this.cv.width = Math.round(this.W * this.DPR);
		this.cv.height = Math.round(this.H * this.DPR);
		this.cv.style.width = `${this.W}px`;
		this.cv.style.height = `${this.H}px`;
		this.floorY = this.H - 30;
		this.makeBg();
		this.makeVignette();
		this.makeGlow();
	}

	private makeBg() {
		const { W, H, DPR, floorY, rodY } = this;
		this.bgCv = document.createElement("canvas");
		this.bgCv.width = this.cv.width;
		this.bgCv.height = this.cv.height;
		const b = this.bgCv.getContext("2d")!;
		b.setTransform(DPR, 0, 0, DPR, 0, 0);
		const g = b.createLinearGradient(0, 0, 0, H);
		g.addColorStop(0, "#1a1e26");
		g.addColorStop(1, "#0a0c10");
		b.fillStyle = g;
		b.fillRect(0, 0, W, H);
		const sp = b.createRadialGradient(W / 2, rodY, 20, W / 2, rodY, H * 0.75);
		sp.addColorStop(0, "rgba(255,240,210,.07)");
		sp.addColorStop(1, "rgba(0,0,0,0)");
		b.fillStyle = sp;
		b.fillRect(0, 0, W, H);
		b.fillStyle = "rgba(255,255,255,.022)";
		for (let i = 0; i < 300; i++) b.fillRect(Math.random() * W, Math.random() * H, 1, 1);
		b.fillStyle = "#14171d";
		b.fillRect(0, floorY, W, H - floorY);
		b.fillStyle = "#272d38";
		b.fillRect(0, floorY, W, 2);
		const rx = W * 0.08,
			rw = W * 0.84;
		const rg = b.createLinearGradient(0, rodY - 5, 0, rodY + 6);
		rg.addColorStop(0, "#8a6844");
		rg.addColorStop(0.5, "#6b4e30");
		rg.addColorStop(1, "#4c3721");
		b.fillStyle = "rgba(0,0,0,.4)";
		b.fillRect(rx - 4, rodY + 7, rw + 8, 5);
		b.fillStyle = rg;
		b.beginPath();
		if (typeof b.roundRect === "function") b.roundRect(rx, rodY - 5, rw, 11, 5);
		else b.rect(rx, rodY - 5, rw, 11);
		b.fill();
		b.fillStyle = "#3a3f4a";
		b.fillRect(rx - 9, rodY - 9, 7, 20);
		b.fillRect(rx + rw + 2, rodY - 9, 7, 20);
	}

	private makeVignette() {
		const { W, H, DPR } = this;
		this.vigCv = document.createElement("canvas");
		this.vigCv.width = this.cv.width;
		this.vigCv.height = this.cv.height;
		const b = this.vigCv.getContext("2d")!;
		b.setTransform(DPR, 0, 0, DPR, 0, 0);
		const g = b.createRadialGradient(
			W / 2,
			H / 2,
			Math.min(W, H) * 0.42,
			W / 2,
			H / 2,
			Math.max(W, H) * 0.75,
		);
		g.addColorStop(0, "rgba(0,0,0,0)");
		g.addColorStop(1, "rgba(0,0,0,.52)");
		b.fillStyle = g;
		b.fillRect(0, 0, W, H);
	}

	private makeGlow() {
		this.glowSpr = document.createElement("canvas");
		this.glowSpr.width = this.glowSpr.height = 64;
		const b = this.glowSpr.getContext("2d")!;
		const g = b.createRadialGradient(32, 32, 2, 32, 32, 32);
		g.addColorStop(0, "rgba(255,190,90,.75)");
		g.addColorStop(0.4, "rgba(255,120,40,.32)");
		g.addColorStop(1, "rgba(255,80,20,0)");
		b.fillStyle = g;
		b.fillRect(0, 0, 64, 64);
	}

	buildCloth(id: string) {
		this.matId = id;
		this.mat = getMaterial(id);
		this.parts = [];
		this.cons = [];
		this.adj = [];
		this.tris = [];
		this.cellCol = [];
		this.grabList = [];
		this.fibers = [];
		this.embers = [];
		this.smokes = [];
		this.drops = [];
		this.glints = [];
		this.slashes = [];
		this.stitches = [];
		this.steams = [];
		this.brokenStruct = 0;
		this.stats.fib = 0;
		this.burningN = 0;
		this.lastBurningN = 0;
		this.partyShown = false;
		this.shake = 0;
		this.firstTearFired = false;
		this.firstCutFired = false;
		this.firstBurnFired = false;
		this.idleFired = false;
		this.hitstop = 0;
		this.spawnT = 0;
		this.builtAt = this.time;
		this.cb.onParty?.(null);

		const { W, H, rodY } = this;
		const clothW = Math.min(W * 0.68, 780);
		const targetS = 16 * this.mat.spMul;
		this.cols = clamp(Math.round(clothW / targetS), 24, 46);
		this.S = clothW / this.cols;
		this.rows = clamp(Math.round(Math.min(H * 0.52, 460) / this.S), 14, 32);
		const x0 = (W - this.S * this.cols) / 2;
		const y0 = rodY + 10;
		const { cols, rows, S } = this;

		for (let j = 0; j <= rows; j++)
			for (let i = 0; i <= cols; i++) {
				const x = x0 + i * S + Math.sin(j * 0.55 + i * 0.2) * 1.5;
				const y = y0 + j * S + Math.cos(i * 0.5 + j * 0.3) * 1.2;
				this.parts.push({
					x,
					y,
					px: x,
					py: y,
					pin: false,
					rodPin: false,
					wet: 0,
					burn: false,
					burnT: 0,
					char: 0,
					fray: null,
					sh: 1,
				});
			}
		const pinEvery = Math.max(2, Math.round(cols / 9));
		for (let i = 0; i <= cols; i += pinEvery) {
			const p = this.parts[i];
			p.pin = true;
			p.rodPin = true;
		}

		this.cH = new Array(cols * (rows + 1));
		this.cV = new Array((cols + 1) * rows);
		this.cD = new Array(cols * rows);

		const addC = (a: number, b: number, type: number, stiffMul?: number) => {
			const p = this.parts[a],
				q = this.parts[b];
			const rest = Math.hypot(q.x - p.x, q.y - p.y) || S;
			const k = Math.min(0.98, this.mat.stiff * this.mat.soft * (stiffMul || 1));
			const c: Constraint = { a, b, rest, type, k, dmg: 1, broken: false, span: null };
			this.cons.push(c);
			return c;
		};

		for (let j = 0; j <= rows; j++)
			for (let i = 0; i < cols; i++)
				this.cH[j * cols + i] = addC(this.idx(i, j), this.idx(i + 1, j), 0);
		for (let j = 0; j < rows; j++)
			for (let i = 0; i <= cols; i++)
				this.cV[j * (cols + 1) + i] = addC(this.idx(i, j), this.idx(i, j + 1), 1);
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++)
				this.cD[j * cols + i] = addC(this.idx(i, j), this.idx(i + 1, j + 1), 2, 0.92);
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) addC(this.idx(i + 1, j), this.idx(i, j + 1), 3, 0.92);

		if (this.mat.bend > 0) {
			for (let j = 0; j <= rows; j++)
				for (let i = 0; i < cols - 1; i++) {
					const c = addC(this.idx(i, j), this.idx(i + 2, j), 4, this.mat.bend);
					const h0 = this.cH[j * cols + i]!,
						h1 = this.cH[j * cols + i + 1]!;
					(h0.span || (h0.span = [])).push(c);
					(h1.span || (h1.span = [])).push(c);
				}
			for (let j = 0; j < rows - 1; j++)
				for (let i = 0; i <= cols; i++) {
					const c = addC(this.idx(i, j), this.idx(i, j + 2), 5, this.mat.bend);
					const v0 = this.cV[j * (cols + 1) + i]!,
						v1 = this.cV[(j + 1) * (cols + 1) + i]!;
					(v0.span || (v0.span = [])).push(c);
					(v1.span || (v1.span = [])).push(c);
				}
		}

		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				this.tris.push({
					a: this.idx(i, j),
					b: this.idx(i + 1, j),
					c: this.idx(i + 1, j + 1),
					k1: this.cH[j * cols + i]!,
					k2: this.cV[j * (cols + 1) + i + 1]!,
					k3: this.cD[j * cols + i]!,
					i,
					j,
				});
				this.tris.push({
					a: this.idx(i, j),
					b: this.idx(i + 1, j + 1),
					c: this.idx(i, j + 1),
					k1: this.cD[j * cols + i]!,
					k2: this.cV[j * (cols + 1) + i]!,
					k3: this.cH[(j + 1) * cols + i]!,
					i,
					j,
				});
			}

		this.adj = this.parts.map(() => []);
		for (const c of this.cons) {
			this.adj[c.a].push(c);
			this.adj[c.b].push(c);
		}
		this.initStruct = this.cons.filter((c) => c.type <= 1).length;
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) this.cellCol.push(this.cellColor(i, j));
		this.windStreaks = [];
		for (let i = 0; i < 16; i++)
			this.windStreaks.push({ x: rand(0, W), y: rand(0, H), l: rand(30, 90), a: rand(0.03, 0.08) });
		for (let k = 0; k < 45; k++) this.step(1 / 60);
		this.fibers = [];
		this.embers = [];
		this.smokes = [];
		this.drops = [];
		this.glints = [];
		this.slashes = [];
		this.stitches = [];
		this.steams = [];
	}

	private cellColor(i: number, j: number) {
		let r = this.mat.color[0],
			g = this.mat.color[1],
			b = this.mat.color[2];
		const m = this.mat.id;
		if (m === "cotton") {
			if (j % 6 < 2) {
				r = 178;
				g = 58;
				b = 58;
			}
			if (i % 6 < 2) {
				r = Math.min(r, 190);
				g = 64;
				b = 64;
			}
			if (i % 6 < 2 && j % 6 < 2) {
				r = 140;
				g = 40;
				b = 40;
			}
			if (i % 6 === 3 || j % 6 === 3) {
				r *= 0.82;
				g *= 0.82;
				b *= 0.82;
			}
		} else if (m === "denim" && (i + j) % 3 === 0) {
			r *= 1.22;
			g *= 1.22;
			b *= 1.22;
		} else if (m === "silk") {
			const s = Math.sin(i * 0.7) * 0.05 + 1;
			r *= s;
			g *= s;
			b *= s;
		} else if (m === "leather" && Math.random() < 0.12) {
			r *= 0.85;
			g *= 0.85;
			b *= 0.85;
		}
		const n = rand(0.95, 1.05);
		return [r * n, g * n, b * n];
	}

	private wm(p: Particle) {
		return 1 / (this.mat.mass * (1 + p.wet * 1.45));
	}
	private effTear(c: Constraint) {
		if (c.type > 1) return 1 + (this.mat.tear - 1) * 1.45;
		const p = this.parts[c.a],
			q = this.parts[c.b];
		return (1 + (this.mat.tear - 1) * c.dmg) * (1 - (p.wet + q.wet) * 0.14);
	}
	private stressOf(c: Constraint) {
		const p = this.parts[c.a],
			q = this.parts[c.b];
		const rest = c.rest > 1e-6 ? c.rest : 1e-6;
		return Math.hypot(q.x - p.x, q.y - p.y) / rest;
	}

	private step(dt: number) {
		this.time += dt;
		const g = 1500 * this.gravMul;
		const dt2 = dt * dt;
		for (let k = 0; k < this.parts.length; k++) {
			const p = this.parts[k];
			if (p.pin) {
				p.px = p.x;
				p.py = p.y;
				continue;
			}
			let vx = (p.x - p.px) * this.mat.damp,
				vy = (p.y - p.py) * this.mat.damp;
			const sp2 = vx * vx + vy * vy;
			if (sp2 > 900) {
				const f = 30 / Math.sqrt(sp2);
				vx *= f;
				vy *= f;
			} else if (!(sp2 <= Number.POSITIVE_INFINITY)) {
				vx = 0;
				vy = 0;
			}
			p.px = p.x;
			p.py = p.y;
			let ax = 0;
			let ay = g * (1 + p.wet * 0.75);
			const w = this.wm(p);
			{
				// base sway keeps the cloth alive even with the wind slider at zero
				const sway = this.windAmp + 0.03;
				const wf =
					Math.sin(this.time * 0.8 + p.y * 0.006) +
					0.55 * Math.sin(this.time * 2.1 + p.y * 0.013 + p.x * 0.004);
				ax += sway * 750 * this.mat.wind * wf * w * (1 - p.wet * 0.7);
			}
			if (this.fan.on) {
				const dx = p.x - this.fan.x,
					dy = p.y - this.fan.y,
					d2 = dx * dx + dy * dy,
					R = 150;
				if (d2 < R * R && d2 > 1) {
					const d = Math.sqrt(d2),
						f = 1 - d / R,
						F = f * f * 1600 * w;
					const sw = Math.sin(this.time * 16 + d * 0.07) * F * 0.45;
					ax += (dx / d) * F - (dy / d) * sw;
					ay += (dy / d) * F * 0.55 + (dx / d) * sw;
				}
			}
			p.x += vx + ax * dt2;
			p.y += vy + ay * dt2;
		}
		if (this.ptr.down && this.tool === "hand" && this.grabList.length) {
			for (const gr of this.grabList) {
				const p = gr.p;
				let tx = this.ptr.x + gr.ox,
					ty = this.ptr.y + gr.oy;
				tx = p.x + clamp(tx - p.x, -90, 90);
				ty = p.y + clamp(ty - p.y, -90, 90);
				const k = Math.min(0.65, (gr.pri ? 0.55 : 0.34) * gr.w * this.wm(p));
				p.x += (tx - p.x) * k;
				p.y += (ty - p.y) * k;
			}
		}
		const it = this.mat.iters;
		for (let n = 0; n < it; n++) {
			for (let k = 0; k < this.cons.length; k++) {
				const c = this.cons[k];
				if (c.broken) continue;
				const p = this.parts[c.a],
					q = this.parts[c.b];
				const inv1 = p.pin ? 0 : this.wm(p),
					inv2 = q.pin ? 0 : this.wm(q);
				const ws = inv1 + inv2;
				if (!ws) continue;
				const dx = q.x - p.x,
					dy = q.y - p.y;
				const d2 = dx * dx + dy * dy;
				if (d2 < 1e-12) continue;
				const d = Math.sqrt(d2);
				const wetSoft = 1 + (p.wet + q.wet) * 0.45;
				const kEff = Math.min(1, c.k / wetSoft);
				const f = ((d - c.rest) / d) * kEff;
				const s1 = f * (inv1 / ws),
					s2 = f * (inv2 / ws);
				p.x += dx * s1;
				p.y += dy * s1;
				q.x -= dx * s2;
				q.y -= dy * s2;
			}
		}
		this.tearPass(dt);
		this.toolHold(dt);
		this.burnPass(dt);
		this.thudAcc = 0;
		for (const p of this.parts) {
			if (p.pin) continue;
			if (p.y > this.floorY) {
				const vy = p.y - p.py,
					vx2 = p.x - p.px;
				p.y = this.floorY;
				p.py = this.floorY + vy * 0.3;
				p.px = p.x - vx2 * 0.55;
				if (vy > 7) this.thudAcc += vy;
			}
			if (p.x < 8) {
				p.x = 8;
				p.px = p.x + (p.px - p.x) * 0.5;
			} else if (p.x > this.W - 8) {
				p.x = this.W - 8;
				p.px = p.x + (p.px - p.x) * 0.5;
			}
		}
		if (this.thudAcc > 12 && this.time - this.lastThud > 0.09) {
			sfx.thudSnd(clamp(this.thudAcc / 45, 0.2, 1));
			this.lastThud = this.time;
		}
	}

	private tearPass(dt: number) {
		this.breaksTear = 0;
		let creak = false;
		for (let k = 0; k < this.cons.length; k++) {
			const c = this.cons[k];
			if (c.broken || c.type > 3) continue;
			const p = this.parts[c.a],
				q = this.parts[c.b];
			const rest = c.rest > 1e-6 ? c.rest : 1e-6;
			const d = Math.hypot(q.x - p.x, q.y - p.y);
			if (d > rest * 5.5) {
				this.breakC(c, "tear", 1.6);
				continue;
			}
			const st = d / rest,
				eff = this.effTear(c);
			if (st > eff) this.breakC(c, "tear", clamp(st / eff, 1, 2.4));
			else if (c.type <= 1 && st > eff * 0.72) {
				c.dmg = Math.max(0.28, c.dmg - dt * 0.16 * (0.7 + this.mat.prop * 0.6));
				if (st > eff * 0.85) creak = true;
			}
		}
		if (this.breaksTear) {
			const v = clamp(0.3 + this.breaksTear * 0.16, 0.3, 1);
			if (this.mat.id === "rubber") sfx.snapSnd(v);
			else if (this.mat.id === "mail") {
				for (let i = 0; i < Math.min(3, this.breaksTear); i++) sfx.tinkSnd();
			} else if (sfx.tryBudget()) sfx.ripSnd(v, this.mat.sndF, this.mat.sndD);
			// Juice: freeze-frame + haptics scale with the burst size
			if (this.breaksTear >= 3) {
				this.hitstop = clamp(0.018 + this.breaksTear * 0.005, 0.018, 0.075);
				haptic([10, 26, 14]);
			} else {
				haptic(8);
			}
			// Tip ladder: first tear milestone, only user-driven (ptr down or input within 0.8s)
			if (!this.firstTearFired && (this.ptr.down || this.time - this.lastInputAt < 0.8)) {
				this.firstTearFired = true;
				this.cb.onMilestone?.("tear");
			}
		}
		if (creak && this.tool === "hand" && this.ptr.down && Math.random() < 0.12) sfx.creakSnd();
	}

	private burnPass(dt: number) {
		this.burningN = 0;
		const charDur = Math.max(0.25, this.mat.charT);
		const canBurn = this.mat.flam > 0.02;
		const burnFx = this.lastBurningN > 36 ? 36 / this.lastBurningN : 1;
		const canEmber = this.embers.length < 220,
			canSmoke = this.smokes.length < 150;
		for (let k = 0; k < this.parts.length; k++) {
			const p = this.parts[k];
			if (p.wet > 0) p.wet = Math.max(0, p.wet - dt * 0.012);
			if (!p.burn) continue;
			if (p.char >= 1) {
				p.burn = false;
				continue;
			}
			this.burningN++;
			if (!canBurn) {
				p.burn = false;
				continue;
			}
			p.burnT += dt * (1 + this.windAmp * 0.8);
			p.char = Math.min(1, p.burnT / charDur);
			if (Math.random() < dt * 2.6 * this.mat.flam) {
				const links = this.adj[k];
				const n = links.length;
				if (n) {
					const c0 = links[(Math.random() * n) | 0];
					if (!c0.broken && c0.type <= 1) {
						const o = this.parts[c0.a === k ? c0.b : c0.a];
						if (!o.burn && o.wet < 0.35 && o.char < 1) {
							o.burn = true;
							o.burnT = 0;
						}
					}
				}
			}
			if (canEmber && Math.random() < dt * 5 * burnFx) this.spawnEmbers(p.x, p.y, 1);
			if (canSmoke && Math.random() < dt * 1.6 * burnFx) this.spawnSmoke(p.x, p.y, 1);
			if (p.burnT >= charDur) {
				p.burn = false;
				p.char = 1;
				p.burnT = charDur;
				for (const c of this.adj[k]) if (!c.broken && c.type <= 1) this.breakC(c, "burn", 1);
			}
		}
		this.lastBurningN = this.burningN;
		if (this.burningN && Math.random() < dt * Math.min(this.burningN, 10) * 1.2 && sfx.tryBudget())
			sfx.crackleSnd();
	}

	private breakC(c: Constraint, cause: string, inten: number) {
		if (c.broken) return;
		c.broken = true;
		if (c.type <= 1) {
			this.brokenStruct++;
			if (c.span) for (const b of c.span) b.broken = true;
		}
		this.stats.fib++;
		const p = this.parts[c.a],
			q = this.parts[c.b];
		const mx = (p.x + q.x) / 2,
			my = (p.y + q.y) / 2;
		const ang = Math.atan2(q.y - p.y, q.x - p.x);
		if (cause === "burn") {
			if (this.embers.length < 220) this.spawnEmbers(mx, my, 1 + (inten | 0));
			if (this.smokes.length < 150 && Math.random() < 0.35) this.spawnSmoke(mx, my, 1);
			this.addFray(p, ang, true, 9);
			this.addFray(q, ang + Math.PI, true, 9);
		} else if (cause === "tear") {
			this.spawnFibers(mx, my, ang, 2 + Math.min(6, (inten * 4) | 0));
			if (inten > 1.3 && Math.random() < 0.22) this.spawnSparks(mx, my, 2);
			this.addFray(p, ang, false, 9);
			this.addFray(q, ang + Math.PI, false, 9);
			this.breaksTear++;
			if (inten > 1.15) this.shake = Math.min(6, this.shake + inten * 0.6);
			if (c.type <= 1 && this.mat.prop > 0) {
				const weaken = 1 - this.mat.prop * 0.55;
				for (const e of [c.a, c.b])
					for (const c2 of this.adj[e]) {
						if (c2.broken || c2.type !== c.type) continue;
						if (this.stressOf(c2) > this.effTear(c2) * 0.5)
							c2.dmg = Math.max(0.25, c2.dmg * weaken);
					}
			}
		} else {
			this.spawnFibers(mx, my, ang, 2);
			this.addFray(p, ang, true, 4);
			this.addFray(q, ang + Math.PI, true, 4);
			if (this.mat.render === "mail") this.spawnSparks(mx, my, 3);
		}
	}

	private markCut() {
		if (!this.firstCutFired) {
			this.firstCutFired = true;
			this.cb.onMilestone?.("cut");
		}
	}
	private markBurn() {
		if (!this.firstBurnFired) {
			this.firstBurnFired = true;
			this.cb.onMilestone?.("burn");
		}
	}

	private addFray(p: Particle, ang: number, dark: boolean, spread: number) {
		if (!p.fray) p.fray = [];
		if (p.fray.length > 6) p.fray.shift();
		p.fray.push({
			a: ang + (rand(-spread, spread) * Math.PI) / 180,
			l: rand(dark ? 2 : 4, dark ? 4 : 9),
			dark: dark || p.char > 0.5,
		});
	}

	private spawnFibers(x: number, y: number, ang: number, n: number) {
		for (let i = 0; i < n && this.fibers.length < 600; i++) {
			const a = ang + rand(-2.4, 2.4),
				sp = rand(60, 300);
			this.fibers.push({
				x,
				y,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp - rand(0, 60),
				l: rand(3, 8),
				life: rand(0.4, 0.9),
				t: 0,
				c: this.mat.color.map((v) => clamp(v * rand(1.05, 1.3), 0, 255) | 0),
			});
		}
	}
	private spawnEmbers(x: number, y: number, n: number) {
		for (let i = 0; i < n && this.embers.length < 220; i++)
			this.embers.push({
				x: x + rand(-4, 4),
				y: y + rand(-4, 4),
				vx: rand(-25, 25),
				vy: rand(-95, -25),
				s: rand(1, 2.4),
				life: rand(0.5, 1.3),
				t: 0,
			});
	}
	private spawnSmoke(x: number, y: number, n: number) {
		for (let i = 0; i < n && this.smokes.length < 150; i++)
			this.smokes.push({
				x: x + rand(-5, 5),
				y: y + rand(-5, 5),
				vx: rand(-9, 9),
				vy: rand(-45, -18),
				s: rand(5, 9),
				life: rand(1.2, 2.2),
				t: 0,
			});
	}
	private spawnSteam(x: number, y: number, n: number) {
		for (let i = 0; i < n && this.steams.length < 120; i++)
			this.steams.push({
				x,
				y,
				vx: rand(-20, 20),
				vy: rand(-90, -40),
				s: rand(3, 6),
				life: rand(0.4, 0.8),
				t: 0,
			});
	}
	private spawnSparks(x: number, y: number, n: number) {
		for (let i = 0; i < n && this.fibers.length < 600; i++) {
			const a = rand(0, TAU),
				sp = rand(120, 360);
			this.fibers.push({
				x,
				y,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp - 80,
				l: rand(2, 4),
				life: rand(0.15, 0.35),
				t: 0,
				c: [255, 230, 150],
				spark: true,
			});
		}
	}
	private spawnDrop(x: number, y: number) {
		if (this.drops.length < 160)
			this.drops.push({ x, y, vx: rand(-15, 15), vy: rand(0, 40), life: 1.4, t: 0 });
	}
	private spawnGlint(x: number, y: number, ang: number) {
		if (this.glints.length < 60)
			this.glints.push({ x, y, a: ang + rand(-0.6, 0.6), life: 0.14, t: 0 });
	}
	private spawnSlash(x1: number, y1: number, x2: number, y2: number) {
		if (this.slashes.length < 40) this.slashes.push({ x1, y1, x2, y2, life: 0.18, t: 0 });
	}
	private spawnStitch(x: number, y: number) {
		if (this.stitches.length < 60) this.stitches.push({ x, y, life: 0.5, t: 0 });
	}

	private swapPop<T>(arr: T[], i: number) {
		const j = arr.length - 1;
		if (i !== j) arr[i] = arr[j];
		arr.pop();
	}

	private updateFX(dt: number) {
		for (let i = this.fibers.length - 1; i >= 0; i--) {
			const f = this.fibers[i];
			f.t += dt;
			f.vy += 500 * dt;
			f.x += f.vx * dt;
			f.y += f.vy * dt;
			if (f.t >= f.life) this.swapPop(this.fibers, i);
		}
		for (let i = this.embers.length - 1; i >= 0; i--) {
			const e = this.embers[i];
			e.t += dt;
			e.x += e.vx * dt + Math.sin(this.time * 20 + e.y) * 0.4;
			e.y += e.vy * dt;
			e.vy *= 1 - dt * 0.6;
			if (e.t >= e.life) this.swapPop(this.embers, i);
		}
		for (let i = this.smokes.length - 1; i >= 0; i--) {
			const s = this.smokes[i];
			s.t += dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.s += 10 * dt;
			if (s.t >= s.life) this.swapPop(this.smokes, i);
		}
		for (let i = this.steams.length - 1; i >= 0; i--) {
			const s = this.steams[i];
			s.t += dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.s += 14 * dt;
			if (s.t >= s.life) this.swapPop(this.steams, i);
		}
		for (let i = this.drops.length - 1; i >= 0; i--) {
			const d = this.drops[i];
			d.t += dt;
			d.vy += 900 * dt;
			d.x += d.vx * dt;
			d.y += d.vy * dt;
			if (d.t >= d.life || d.y > this.floorY) this.swapPop(this.drops, i);
		}
		for (let i = this.glints.length - 1; i >= 0; i--) {
			this.glints[i].t += dt;
			if (this.glints[i].t >= this.glints[i].life) this.swapPop(this.glints, i);
		}
		for (let i = this.slashes.length - 1; i >= 0; i--) {
			this.slashes[i].t += dt;
			if (this.slashes[i].t >= this.slashes[i].life) this.swapPop(this.slashes, i);
		}
		for (let i = this.stitches.length - 1; i >= 0; i--) {
			this.stitches[i].t += dt;
			if (this.stitches[i].t >= this.stitches[i].life) this.swapPop(this.stitches, i);
		}
		if (Math.random() < dt * 10) {
			const p = this.parts[(Math.random() * this.parts.length) | 0];
			if (p.wet > 0.5 && !p.pin) this.spawnDrop(p.x, p.y);
		}
	}

	private segSegHit(
		ax: number,
		ay: number,
		bx: number,
		by: number,
		cx: number,
		cy: number,
		dx: number,
		dy: number,
	) {
		const r1x = bx - ax,
			r1y = by - ay,
			r2x = dx - cx,
			r2y = dy - cy;
		const den = r1x * r2y - r1y * r2x;
		if (Math.abs(den) < 1e-9) return false;
		const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
		const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
		return t >= 0 && t <= 1 && u >= 0 && u <= 1;
	}
	private segPointDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
		const dx = bx - ax,
			dy = by - ay,
			l2 = dx * dx + dy * dy || 1e-9;
		const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
		return Math.hypot(ax + dx * t - px, ay + dy * t - py);
	}
	private cutSeg(x1: number, y1: number, x2: number, y2: number, rad: number, cause: string) {
		const minx = Math.min(x1, x2) - rad - 6,
			maxx = Math.max(x1, x2) + rad + 6;
		const miny = Math.min(y1, y2) - rad - 6,
			maxy = Math.max(y1, y2) + rad + 6;
		let n = 0;
		for (let k = 0; k < this.cons.length; k++) {
			const c = this.cons[k];
			if (c.broken || c.type > 3) continue;
			const p = this.parts[c.a],
				q = this.parts[c.b];
			if (
				(p.x < minx && q.x < minx) ||
				(p.x > maxx && q.x > maxx) ||
				(p.y < miny && q.y < miny) ||
				(p.y > maxy && q.y > maxy)
			)
				continue;
			let hit: boolean;
			if (rad > 0) hit = this.segPointDist((p.x + q.x) / 2, (p.y + q.y) / 2, x1, y1, x2, y2) < rad;
			else hit = this.segSegHit(x1, y1, x2, y2, p.x, p.y, q.x, q.y);
			if (hit) {
				this.breakC(c, cause, 0.7);
				if (++n > 70) break;
			}
		}
		return n;
	}
	private nearestPart(x: number, y: number, r: number, pinOk: boolean) {
		let best: Particle | null = null,
			bd = r * r;
		for (const p of this.parts) {
			if (!pinOk && p.pin) continue;
			const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
			if (d < bd) {
				bd = d;
				best = p;
			}
		}
		return best;
	}

	private bindInput() {
		const cv = this.cv;
		const onCtx = (e: Event) => e.preventDefault();
		const onDown = (e: PointerEvent) => {
			sfx.ensureAudio();
			void sfx.resumeAudio();
			if (this.ptr.down) return;
			this.ptr.down = true;
			this.lastInputAt = this.time;
			this.ptr.id = e.pointerId;
			const r = cv.getBoundingClientRect();
			this.ptr.x = e.clientX - r.left;
			this.ptr.y = e.clientY - r.top;
			this.ptr.px = this.ptr.x;
			this.ptr.py = this.ptr.y;
			this.ptr.lastT = performance.now();
			try {
				cv.setPointerCapture(e.pointerId);
			} catch {
				/* */
			}
			this.toolDown();
		};
		const onMove = (e: PointerEvent) => {
			const r = cv.getBoundingClientRect();
			const x = e.clientX - r.left,
				y = e.clientY - r.top;
			const now = performance.now(),
				dt = Math.max(8, now - this.ptr.lastT);
			this.ptr.vx = this.ptr.vx * 0.6 + ((x - this.ptr.x) / dt) * 1000 * 0.4;
			this.ptr.vy = this.ptr.vy * 0.6 + ((y - this.ptr.y) / dt) * 1000 * 0.4;
			this.ptr.lastT = now;
			if (this.ptr.down) {
				this.lastInputAt = this.time;
				if (e.pointerId !== this.ptr.id) return;
			}
			this.ptr.px = this.ptr.x;
			this.ptr.py = this.ptr.y;
			this.ptr.x = x;
			this.ptr.y = y;
			if (this.ptr.down) this.toolMove();
		};
		const release = (e?: PointerEvent) => {
			if (!this.ptr.down || (e && e.pointerId !== this.ptr.id)) return;
			this.ptr.down = false;
			this.grabList = [];
			this.fan.on = false;
			sfx.stopSpray();
			sfx.stopFan();
			this.toolUp();
		};
		const onBlur = () => {
			this.ptr.down = false;
			this.grabList = [];
			this.fan.on = false;
			sfx.stopSpray();
			sfx.stopFan();
		};
		cv.addEventListener("contextmenu", onCtx);
		cv.addEventListener("pointerdown", onDown);
		cv.addEventListener("pointermove", onMove);
		cv.addEventListener("pointerup", release);
		cv.addEventListener("pointercancel", release);
		window.addEventListener("blur", onBlur);
		this.unbind.push(
			() => cv.removeEventListener("contextmenu", onCtx),
			() => cv.removeEventListener("pointerdown", onDown),
			() => cv.removeEventListener("pointermove", onMove),
			() => cv.removeEventListener("pointerup", release),
			() => cv.removeEventListener("pointercancel", release),
			() => window.removeEventListener("blur", onBlur),
		);
	}

	private toolDown() {
		const x = this.ptr.x,
			y = this.ptr.y;
		switch (this.tool) {
			case "hand": {
				this.grabList = [];
				let bi = -1,
					bd = 1e9;
				for (const p of this.parts) {
					const d = Math.hypot(p.x - x, p.y - y);
					if (d < 36 && !p.pin) {
						if (d < bd) {
							bd = d;
							bi = this.grabList.length;
						}
						const w = 1 - d / 36;
						this.grabList.push({ p, ox: p.x - x, oy: p.y - y, w: w * w + 0.05, pri: false });
					}
				}
				if (bi >= 0) this.grabList[bi].pri = true;
				break;
			}
			case "scissors": {
				this.lastCutX = x;
				this.lastCutY = y;
				const n = this.cutSeg(x - 5, y, x + 5, y, 5, "cut");
				if (n) {
					this.snipT = 1;
					this.markCut();
					if (performance.now() - this.lastSnipSnd > 60) {
						sfx.snipSnd();
						this.lastSnipSnd = performance.now();
					}
					for (let i = 0; i < 3; i++) this.spawnGlint(x, y, rand(0, TAU));
				} else this.snipT = 1;
				break;
			}
			case "torch":
				sfx.fwoofSnd();
				break;
			case "water":
				sfx.startSpray();
				break;
			case "pin": {
				const p = this.nearestPart(x, y, 18, true);
				if (p) {
					p.pin = !p.pin;
					if (p.pin) {
						p.px = p.x;
						p.py = p.y;
					}
					p.rodPin = false;
					sfx.pinSnd();
				}
				break;
			}
			case "fan":
				this.fan.on = true;
				this.fan.x = x;
				this.fan.y = y;
				sfx.startFan();
				break;
			default:
				break;
		}
	}

	private toolMove() {
		const x = this.ptr.x,
			y = this.ptr.y;
		switch (this.tool) {
			case "scissors": {
				const d = Math.hypot(x - this.lastCutX, y - this.lastCutY);
				if (d > 15) {
					const cutAng = Math.atan2(y - this.lastCutY, x - this.lastCutX);
					const n = this.cutSeg(this.lastCutX, this.lastCutY, x, y, 0, "cut");
					this.lastCutX = x;
					this.lastCutY = y;
					if (n) {
						this.snipT = 1;
						this.markCut();
						if (performance.now() - this.lastSnipSnd > 60) {
							sfx.snipSnd();
							this.lastSnipSnd = performance.now();
						}
						this.spawnGlint(x, y, cutAng + Math.PI / 2);
					}
				}
				break;
			}
			case "knife": {
				const sp = Math.hypot(this.ptr.vx, this.ptr.vy);
				if (sp > 800) {
					const jag = 3;
					const n = this.cutSeg(
						this.ptr.px + rand(-jag, jag),
						this.ptr.py + rand(-jag, jag),
						x + rand(-jag, jag),
						y + rand(-jag, jag),
						6,
						"cut",
					);
					if (n) {
						this.spawnSlash(this.ptr.px, this.ptr.py, x, y);
						this.markCut();
						if (performance.now() - this.lastSnipSnd > 90) {
							sfx.whooshSnd(sp / 2500);
							this.lastSnipSnd = performance.now();
						}
					}
				} else if (sp > 60) {
					for (const p of this.parts) {
						const d = Math.hypot(p.x - x, p.y - y);
						if (d < 30 && d > 1) {
							const push = (30 - d) * 0.02;
							p.x += ((p.x - x) / d) * push;
							p.y += ((p.y - y) / d) * push;
						}
					}
				}
				break;
			}
			case "needle": {
				for (const c of this.cons) {
					if (!c.broken || c.type > 3) continue;
					const p = this.parts[c.a],
						q = this.parts[c.b];
					if (
						Math.hypot(p.x - x, p.y - y) < 28 &&
						Math.hypot(q.x - x, q.y - y) < 28 &&
						Math.hypot(q.x - p.x, q.y - p.y) < c.rest * 1.7
					) {
						c.broken = false;
						if (c.type <= 1) this.brokenStruct = Math.max(0, this.brokenStruct - 1);
						this.spawnStitch((p.x + q.x) / 2, (p.y + q.y) / 2);
						if (performance.now() - this.lastSnipSnd > 70) {
							sfx.sewSnd();
							this.lastSnipSnd = performance.now();
						}
					}
				}
				break;
			}
			case "fan":
				this.fan.x = x;
				this.fan.y = y;
				break;
			default:
				break;
		}
	}

	private toolUp() {
		this.snipT = 0.4;
	}

	private toolHold(dt: number) {
		if (!this.ptr.down) return;
		const x = this.ptr.x,
			y = this.ptr.y;
		if (this.tool === "torch") {
			let lit = 0;
			const R2 = 784;
			if (this.mat.flam > 0.02)
				for (const p of this.parts) {
					if (p.burn || p.char >= 1 || p.wet >= 0.35) continue;
					const dx = p.x - x,
						dy = p.y - y;
					if (dx * dx + dy * dy < R2) {
						p.burn = true;
						p.burnT = 0;
						lit++;
						this.markBurn();
						if (lit > 14) break;
					}
				}
			if (lit && performance.now() - this.lastFwoof > 200) {
				sfx.fwoofSnd();
				this.lastFwoof = performance.now();
			}
			if (this.embers.length < 220 && Math.random() < dt * 18)
				this.spawnEmbers(x + rand(-6, 6), y + rand(-6, 6), 1);
		} else if (this.tool === "water") {
			const R2 = 1936;
			for (const p of this.parts) {
				const dx = p.x - x,
					dy = p.y - y;
				if (dx * dx + dy * dy < R2) {
					p.wet = Math.min(1, p.wet + dt * 3);
					if (p.burn && p.wet > 0.3) {
						p.burn = false;
						this.spawnSteam(p.x, p.y, 2);
						if (sfx.tryBudget()) sfx.steamSnd();
					}
				}
			}
			if (Math.random() < dt * 30) this.spawnDrop(x + rand(-14, 14), y + rand(-6, 6));
		}
	}

	private computeShade() {
		const { cols, rows, S } = this;
		for (let j = 0; j <= rows; j++)
			for (let i = 0; i <= cols; i++) {
				const p = this.parts[this.idx(i, j)];
				const dl =
					i > 0 && this.cH[j * cols + i - 1] && !this.cH[j * cols + i - 1]!.broken
						? Math.hypot(
								p.x - this.parts[this.idx(i - 1, j)].x,
								p.y - this.parts[this.idx(i - 1, j)].y,
							)
						: S;
				const dr =
					i < cols && this.cH[j * cols + i] && !this.cH[j * cols + i]!.broken
						? Math.hypot(
								p.x - this.parts[this.idx(i + 1, j)].x,
								p.y - this.parts[this.idx(i + 1, j)].y,
							)
						: S;
				const du =
					j > 0 && this.cV[(j - 1) * (cols + 1) + i] && !this.cV[(j - 1) * (cols + 1) + i]!.broken
						? Math.hypot(
								p.x - this.parts[this.idx(i, j - 1)].x,
								p.y - this.parts[this.idx(i, j - 1)].y,
							)
						: S;
				const dd =
					j < rows && this.cV[j * (cols + 1) + i] && !this.cV[j * (cols + 1) + i]!.broken
						? Math.hypot(
								p.x - this.parts[this.idx(i, j + 1)].x,
								p.y - this.parts[this.idx(i, j + 1)].y,
							)
						: S;
				const h = Math.min(1, ((dl + dr) / (2 * S)) * 0.5 + ((du + dd) / (2 * S)) * 0.5);
				const tx = clamp(((dr - dl) / S) * 1.3, -1, 1),
					ty = clamp(((dd - du) / S) * 1.3, -1, 1);
				p.sh = clamp(0.58 + 0.44 * h - 0.09 * tx - 0.06 * ty, 0.34, 1.18);
			}
	}

	private render() {
		const ctx = this.ctx;
		const { W, H, DPR } = this;
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		const sx = this.shake > 0.1 ? rand(-this.shake, this.shake) : 0;
		const sy = this.shake > 0.1 ? rand(-this.shake, this.shake) : 0;
		ctx.save();
		ctx.translate(sx, sy);
		if (this.bgCv) ctx.drawImage(this.bgCv, 0, 0, W, H);
		if (this.windAmp > 0.15) {
			ctx.lineWidth = 1;
			for (const s of this.windStreaks) {
				ctx.strokeStyle = `rgba(200,215,255,${s.a * Math.min(1, this.windAmp)})`;
				ctx.beginPath();
				ctx.moveTo(s.x, s.y);
				ctx.lineTo(s.x + s.l * this.windAmp * 3, s.y + Math.sin(s.x * 0.02) * 3);
				ctx.stroke();
			}
		}
		if (this.frameN & 1) this.computeShade();
		// Fill-in on fresh cloth: ease from 35% so the cloth is never invisible on open
		const fill = this.spawnT < 1 ? 0.35 + 0.65 * this.spawnT * this.spawnT : 1;
		if (fill < 1) ctx.globalAlpha = fill;
		if (this.mat.render === "mail") this.renderMail();
		else this.renderCloth();
		this.renderFrays();
		this.renderPins();
		if (fill < 1) ctx.globalAlpha = 1;
		if (!this.firstTearFired && this.spawnT >= 1) this.drawGhostPinch();
		this.renderFX();
		ctx.restore();
		if (this.vigCv) ctx.drawImage(this.vigCv, 0, 0, W, H);
		if (this.ptr.x || this.ptr.y) this.drawCursor();
	}

	private renderCloth() {
		const ctx = this.ctx;
		for (const t of this.tris) {
			if (t.k1.broken || t.k2.broken || t.k3.broken) continue;
			const a = this.parts[t.a],
				b = this.parts[t.b],
				c = this.parts[t.c];
			const cc = this.cellCol[t.j * this.cols + t.i];
			const sh = (a.sh + b.sh + c.sh) / 3;
			const wet = (a.wet + b.wet + c.wet) / 3;
			const ch = (a.char + b.char + c.char) / 3;
			let br = 0;
			if (a.burn) br++;
			if (b.burn) br++;
			if (c.burn) br++;
			br /= 3;
			let r = cc[0] * sh,
				g = cc[1] * sh,
				bl = cc[2] * sh;
			if (wet > 0) {
				r *= 1 - wet * 0.32;
				g *= 1 - wet * 0.3;
				bl *= 1 - wet * 0.18;
			}
			if (ch > 0) {
				r = lerp(r, 26, ch * 0.92);
				g = lerp(g, 20, ch * 0.92);
				bl = lerp(bl, 17, ch * 0.92);
			}
			if (br > 0) {
				const fl = 0.5 + ((t.i * 17 + t.j * 31 + this.frameN) & 7) * 0.0625;
				r += br * 110 * fl;
				g += br * 45 * fl;
			}
			if (this.mat.gloss > 0) {
				const she = Math.max(0, sh - 0.9) * this.mat.gloss * 4;
				r += she * 255;
				g += she * 255;
				bl += she * 255;
			}
			ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.lineTo(c.x, c.y);
			ctx.closePath();
			ctx.fill();
		}
		ctx.lineWidth = 1;
		ctx.lineCap = "butt";
		ctx.beginPath();
		for (const c of this.cons) {
			if (c.broken || c.type !== 0) continue;
			const p = this.parts[c.a],
				q = this.parts[c.b];
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
		}
		ctx.strokeStyle = "rgba(255,255,255,.055)";
		ctx.stroke();
		ctx.beginPath();
		for (const c of this.cons) {
			if (c.broken || c.type !== 1) continue;
			const p = this.parts[c.a],
				q = this.parts[c.b];
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
		}
		ctx.strokeStyle = "rgba(0,0,0,.07)";
		ctx.stroke();
	}

	private renderMail() {
		const ctx = this.ctx;
		ctx.lineWidth = 2;
		ctx.strokeStyle = "#3a3f49";
		ctx.beginPath();
		for (const c of this.cons) {
			if (c.broken || c.type > 1) continue;
			const p = this.parts[c.a],
				q = this.parts[c.b];
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
		}
		ctx.stroke();
		const r = this.S * 0.42;
		for (let k = 0; k < this.parts.length; k++) {
			const p = this.parts[k];
			let linked = false;
			for (const c of this.adj[k])
				if (!c.broken && c.type <= 1) {
					linked = true;
					break;
				}
			if (!linked) continue;
			ctx.lineWidth = 2.4;
			ctx.strokeStyle = `rgba(90,96,108,${0.9 * p.sh})`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, r, 0.4, 3.4);
			ctx.stroke();
			ctx.strokeStyle = `rgba(210,216,228,${0.9 * p.sh})`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, r, 3.6, 6);
			ctx.stroke();
		}
	}

	private renderFrays() {
		const ctx = this.ctx;
		ctx.lineWidth = 1.2;
		ctx.lineCap = "round";
		for (const p of this.parts) {
			if (!p.fray) continue;
			for (const f of p.fray) {
				const cc = this.mat.color;
				const base =
					f.dark || p.char > 0.5 ? [38, 32, 28] : [cc[0] * 0.85, cc[1] * 0.85, cc[2] * 0.85];
				ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},.8)`;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x + Math.cos(f.a) * f.l, p.y + Math.sin(f.a) * f.l);
				ctx.stroke();
			}
		}
		ctx.lineCap = "butt";
	}

	private renderPins() {
		const ctx = this.ctx;
		for (const p of this.parts) {
			if (!p.pin) continue;
			if (p.rodPin) {
				ctx.fillStyle = "#c8cedb";
				ctx.beginPath();
				if (typeof ctx.roundRect === "function") ctx.roundRect(p.x - 5, this.rodY + 4, 10, 9, 2);
				else ctx.rect(p.x - 5, this.rodY + 4, 10, 9);
				ctx.fill();
				ctx.fillStyle = "#8b93a2";
				ctx.fillRect(p.x - 5, this.rodY + 11, 10, 2);
			} else {
				ctx.strokeStyle = "#999";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x + 4, p.y - 9);
				ctx.stroke();
				ctx.fillStyle = "#e23b3b";
				ctx.beginPath();
				ctx.arc(p.x, p.y, 3.4, 0, TAU);
				ctx.fill();
			}
		}
	}

	private renderFX() {
		const ctx = this.ctx;
		ctx.save();
		ctx.lineWidth = 1.4;
		ctx.lineCap = "round";
		for (const f of this.fibers) {
			const a = 1 - f.t / f.life;
			ctx.strokeStyle = `rgba(${f.c[0]},${f.c[1]},${f.c[2]},${a})`;
			ctx.beginPath();
			ctx.moveTo(f.x, f.y);
			const vl = Math.hypot(f.vx, f.vy) || 1;
			ctx.lineTo(f.x - (f.vx / vl) * f.l, f.y - (f.vy / vl) * f.l);
			ctx.stroke();
		}
		ctx.globalCompositeOperation = "lighter";
		for (const e of this.embers) {
			const a = 1 - e.t / e.life;
			ctx.fillStyle = `rgba(255,${(140 + Math.random() * 80) | 0},40,${a})`;
			ctx.beginPath();
			ctx.arc(e.x, e.y, e.s, 0, TAU);
			ctx.fill();
		}
		ctx.globalCompositeOperation = "source-over";
		for (const s of this.smokes) {
			ctx.fillStyle = `rgba(130,130,135,${0.14 * (1 - s.t / s.life)})`;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.s, 0, TAU);
			ctx.fill();
		}
		for (const s of this.steams) {
			ctx.fillStyle = `rgba(220,230,240,${0.22 * (1 - s.t / s.life)})`;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.s, 0, TAU);
			ctx.fill();
		}
		ctx.fillStyle = "rgba(130,180,220,.75)";
		for (const d of this.drops) {
			ctx.beginPath();
			ctx.ellipse(d.x, d.y, 1.4, 2.4, 0, 0, TAU);
			ctx.fill();
		}
		ctx.lineWidth = 1.6;
		for (const g of this.glints) {
			const a = 1 - g.t / g.life;
			ctx.strokeStyle = `rgba(255,255,255,${a})`;
			ctx.beginPath();
			ctx.moveTo(g.x + Math.cos(g.a) * 3, g.y + Math.sin(g.a) * 3);
			ctx.lineTo(g.x + Math.cos(g.a) * 8, g.y + Math.sin(g.a) * 8);
			ctx.stroke();
		}
		for (const s of this.slashes) {
			const a = 1 - s.t / s.life;
			ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
			ctx.lineWidth = 2.5;
			ctx.beginPath();
			ctx.moveTo(s.x1, s.y1);
			ctx.lineTo(s.x2, s.y2);
			ctx.stroke();
		}
		for (const s of this.stitches) {
			const a = 1 - s.t / s.life;
			ctx.strokeStyle = `rgba(120,230,140,${a})`;
			ctx.beginPath();
			ctx.moveTo(s.x - 4, s.y);
			ctx.lineTo(s.x + 4, s.y);
			ctx.moveTo(s.x, s.y - 4);
			ctx.lineTo(s.x, s.y + 4);
			ctx.stroke();
		}
		if (this.burningN > 0 && this.glowSpr) {
			ctx.globalCompositeOperation = "lighter";
			let n = 0;
			for (const p of this.parts) {
				if (!p.burn) continue;
				ctx.globalAlpha = 0.16 + Math.random() * 0.1;
				ctx.drawImage(this.glowSpr, p.x - 34, p.y - 34, 68, 68);
				if (++n > 40) break;
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		}
		ctx.restore();
		ctx.lineCap = "butt";
	}

	/** Cold-open hook: pulsing pinch hint on the cloth until the first user tear. No auto-demo rip. */
	private drawGhostPinch() {
		const age = this.time - this.builtAt;
		if (age > GHOST_HINT_MAX_AGE_S) return;
		const p = this.parts[this.idx(this.cols >> 1, ((this.rows * 0.42) | 0) + 1)];
		if (!p || p.pin) return;
		const ctx = this.ctx;
		const fade = age < 8 ? 1 : Math.max(0, 1 - (age - 8) / (GHOST_HINT_MAX_AGE_S - 8));
		const pinch = Math.sin(((age % 1.7) / 1.7) * Math.PI);
		const a = fade * (0.38 - 0.14 * pinch);
		const r = 24 - pinch * 9;
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.strokeStyle = `rgba(232,161,58,${a})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, TAU);
		ctx.stroke();
		const gap = r + 7 - pinch * 5;
		ctx.fillStyle = `rgba(232,161,58,${a * 0.75})`;
		for (const s of [-1, 1]) {
			ctx.beginPath();
			ctx.arc(0, s * gap, 3, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
	}

	private drawCursor() {
		const ctx = this.ctx;
		const x = this.ptr.x,
			y = this.ptr.y;
		ctx.save();
		ctx.translate(x, y);
		ctx.strokeStyle = "rgba(232,161,58,.4)";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(0, 0, 15, 0, TAU);
		ctx.stroke();
		let id: string = this.tool;
		if (this.tool === "hand" && this.ptr.down) id = "fist";
		if (this.tool === "scissors")
			ctx.rotate(-0.5 + Math.sin(this.snipT * 30) * 0.22 * (this.snipT > 0 ? 1 : 0));
		if (this.tool === "knife")
			ctx.rotate(clamp(Math.atan2(this.ptr.vy, this.ptr.vx) * 0.35, -0.7, 0.7));
		if (this.tool === "torch" && this.glowSpr) {
			ctx.globalCompositeOperation = "lighter";
			ctx.globalAlpha = 0.5 + Math.random() * 0.15;
			ctx.drawImage(this.glowSpr, -30, -30, 60, 60);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		}
		if (this.tool === "fan" && this.fan.on) {
			ctx.strokeStyle = "rgba(190,210,255,.4)";
			ctx.lineWidth = 2;
			for (let i = 0; i < 2; i++) {
				ctx.beginPath();
				ctx.arc(0, 0, 26 + i * 14, this.time * 6 + i * 2, this.time * 6 + i * 2 + 2);
				ctx.stroke();
			}
		}
		this.drawCursorGlyph(id);
		ctx.restore();
	}

	private drawCursorGlyph(id: string) {
		const ctx = this.ctx;
		ctx.strokeStyle = "rgba(232,161,58,.95)";
		ctx.fillStyle = "rgba(232,161,58,.95)";
		ctx.lineWidth = 1.7;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.save();
		ctx.scale(0.95, 0.95);
		if (id === "hand" || id === "fist") {
			ctx.beginPath();
			ctx.moveTo(-5, -2);
			ctx.lineTo(-5, -7.5);
			ctx.moveTo(-2, -3);
			ctx.lineTo(-2, -9);
			ctx.moveTo(1, -2.5);
			ctx.lineTo(1, -7.2);
			ctx.moveTo(4, -1);
			ctx.lineTo(4, -5.5);
			ctx.moveTo(-5, -2);
			ctx.quadraticCurveTo(-6, 6, 0, 9);
			ctx.quadraticCurveTo(6, 6, 5, -1);
			ctx.stroke();
		} else if (id === "scissors") {
			ctx.beginPath();
			ctx.arc(-5, -5, 2.2, 0, TAU);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-5, 5, 2.2, 0, TAU);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-3, -3.5);
			ctx.lineTo(8, 5.5);
			ctx.moveTo(-3, 3.5);
			ctx.lineTo(8, -5.5);
			ctx.stroke();
		} else if (id === "knife") {
			ctx.beginPath();
			ctx.moveTo(-7, 5);
			ctx.lineTo(4, -6);
			ctx.lineTo(7, -3);
			ctx.lineTo(-3, 8);
			ctx.closePath();
			ctx.stroke();
		} else if (id === "torch") {
			ctx.beginPath();
			ctx.moveTo(-2.5, 3);
			ctx.lineTo(-2.5, 8);
			ctx.quadraticCurveTo(0, 10, 2.5, 8);
			ctx.lineTo(2.5, 3);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-3, 3);
			ctx.quadraticCurveTo(0, -2, 3, 3);
			ctx.stroke();
		} else if (id === "water") {
			ctx.beginPath();
			ctx.moveTo(0, -8);
			ctx.bezierCurveTo(6, -1, 6, 5, 0, 8);
			ctx.bezierCurveTo(-6, 5, -6, -1, 0, -8);
			ctx.stroke();
		} else if (id === "pin") {
			ctx.beginPath();
			ctx.moveTo(0, 4);
			ctx.lineTo(0, 10);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-3.5, -8);
			ctx.lineTo(3.5, -8);
			ctx.lineTo(2.5, -2);
			ctx.lineTo(4.5, 1);
			ctx.lineTo(4.5, 3);
			ctx.lineTo(-4.5, 3);
			ctx.lineTo(-4.5, 1);
			ctx.lineTo(-2.5, -2);
			ctx.closePath();
			ctx.stroke();
		} else if (id === "needle") {
			ctx.beginPath();
			ctx.moveTo(6, -7);
			ctx.lineTo(-6, 8);
			ctx.lineTo(-4.5, 9.5);
			ctx.lineTo(8, -5);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(7.5, -7.5, 1.6, 0, TAU);
			ctx.stroke();
		} else if (id === "fan") {
			ctx.beginPath();
			ctx.arc(0, 0, 1.6, 0, TAU);
			ctx.stroke();
			for (let i = 0; i < 4; i++) {
				ctx.save();
				ctx.rotate((i * Math.PI) / 2 + 0.3);
				ctx.beginPath();
				ctx.moveTo(0, -2);
				ctx.quadraticCurveTo(6, -8, 9, -3);
				ctx.quadraticCurveTo(4, -1, 0, -2);
				ctx.stroke();
				ctx.restore();
			}
		}
		ctx.restore();
	}

	private countPieces() {
		const n = this.parts.length,
			seen = new Uint8Array(n),
			stack: number[] = [];
		let cnt = 0;
		for (let s = 0; s < n; s++) {
			if (seen[s]) continue;
			let size = 0;
			stack.length = 0;
			stack.push(s);
			seen[s] = 1;
			while (stack.length) {
				const u = stack.pop()!;
				size++;
				for (const c of this.adj[u]) {
					if (c.broken || c.type > 1) continue;
					const v = c.a === u ? c.b : c.a;
					if (!seen[v]) {
						seen[v] = 1;
						stack.push(v);
					}
				}
			}
			if (size > 3) cnt++;
		}
		return Math.max(1, cnt);
	}

	private loop = (now: number) => {
		if (this.disposed) return;
		this.raf = requestAnimationFrame(this.loop);
		let dt = (now - this.last) / 1000;
		this.last = now;
		if (dt > 0.1) dt = 0.1;
		this.fpsAcc += dt;
		this.fpsN++;
		const ts = this.slowmo ? 0.28 : 1;
		if (this.hitstop > 0) {
			this.hitstop -= dt;
		} else {
			this.acc += dt * ts;
			const FIXED = 1 / 60;
			let steps = 0;
			const maxSteps = this.lastBurningN > 48 ? 2 : this.lastBurningN > 20 ? 3 : 5;
			while (this.acc >= FIXED && steps < maxSteps) {
				this.step(FIXED);
				this.updateFX(FIXED);
				this.acc -= FIXED;
				steps++;
			}
			if (steps >= maxSteps) this.acc = 0;
		}
		if (this.spawnT < 1) this.spawnT = Math.min(1, this.spawnT + dt * 2.4);
		this.snipT = Math.max(0, this.snipT - dt * 6);
		this.shake *= Math.pow(0.0001, dt);
		if (this.shake < 0.1) this.shake = 0;
		for (const s of this.windStreaks) {
			s.x += this.windAmp * 260 * dt * ts;
			if (s.x > this.W + 40) {
				s.x = -40;
				s.y = rand(0, this.H);
			}
		}
		this.frameN++;
		if (
			!this.idleFired &&
			!this.partyShown &&
			this.spawnT >= 1 &&
			this.time - this.builtAt > 5 &&
			this.time - this.lastInputAt > IDLE_AFTER_S
		) {
			this.idleFired = true;
			this.cb.onIdle?.();
		}
		if (this.frameN % 20 === 0) this.pieces = this.countPieces();
		if (now - this.lastStats > 250) {
			this.lastStats = now;
			const pct = this.brokenStruct / this.initStruct;
			const fps = this.fpsAcc > 0 ? Math.round(this.fpsN / this.fpsAcc) : 0;
			this.fpsAcc = 0;
			this.fpsN = 0;
			this.cb.onStats?.({
				destroyed: pct,
				pieces: this.pieces,
				fibers: this.stats.fib,
				fps,
				burning: this.burningN,
			});
			if (pct >= 0.96 && !this.partyShown) {
				this.partyShown = true;
				haptic([25, 50, 25, 50, 110]);
				this.cb.onParty?.({
					fibers: this.stats.fib,
					pieces: this.pieces,
					pct,
					seconds: Math.max(1, Math.round(this.time - this.builtAt)),
				});
			}
		}
		this.render();
	};
}
