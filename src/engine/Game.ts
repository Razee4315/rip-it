/**
 * The game loop: owns the cloth, the wind, the renderer and the player's tools,
 * and reports progress toward the level objective.
 */
import type { HudState, LevelDef, LevelResult, RunStats } from "@/game/types";
import { haptic } from "@/lib/haptics";
import { audio } from "./audio/audio";
import {
	Cloth,
	DT,
	EV_BURN,
	EV_CUT,
	EV_STEAM,
	EV_STRIDE,
	EV_TEAR,
	type Grab,
	PIN_USER,
} from "./cloth/Cloth";
import { type Fabric, getFabric } from "./cloth/fabrics";
import { buildLayout } from "./cloth/layout";
import { Wind } from "./cloth/wind";
import { type Frame, type Prop, QUALITY, Renderer } from "./gfx/Renderer";
import { paintArt } from "./gfx/art";
import { ENVS, type EnvDef } from "./gfx/environments";
import { hexToLinear } from "./gfx/gl";
import { artProps, mountProps, pinProps } from "./gfx/hardware";
import {
	P_CONFETTI,
	P_DROP,
	P_EMBER,
	P_FIBER,
	P_FLAME,
	P_FLASH,
	P_MIST,
	P_MOTE,
	P_PETAL,
	P_PUFF,
	P_SMOKE,
	P_SPARK,
	P_STEAM,
	Particles,
} from "./gfx/particles";
import { drawPrint, insidePolygon, shapePolygon } from "./gfx/prints";
import { TAU, clamp, compose, lookAt, mat4, perspective, rand } from "./math";
import { TOOLS, type ToolId } from "./tools";

/** every cloth uses the same mesh density so every level tears the same way */
const CELL = 0.042;
const FOV = (30 * Math.PI) / 180;
/** most substeps one frame may run: enough to cover a 30 fps frame in full */
const MAX_STEPS = 26;

export type QualityTier = "low" | "medium" | "high";

export type GameCallbacks = {
	onHud?: (h: HudState) => void;
	onComplete?: (r: LevelResult) => void;
	onFail?: (reason: string) => void;
	onHint?: (msg: string) => void;
	onQuality?: (tier: QualityTier) => void;
};

type Ptr = {
	id: number;
	x: number;
	y: number;
	px: number;
	py: number;
	vx: number;
	vy: number;
	t: number;
	downX: number;
	downY: number;
	travel: number;
	grab: Grab | null;
	/** drag plane: point and normal */
	plx: number;
	ply: number;
	plz: number;
	cut: boolean;
};

type Cracker = { p: number; t: number; x: number; y: number; z: number };

const CONFETTI: [number, number, number][] = [
	[1, 0.25, 0.14],
	[1, 0.72, 0.1],
	[0.2, 0.75, 1],
	[0.35, 0.9, 0.4],
	[1, 0.4, 0.75],
	[0.98, 0.95, 0.88],
];

export class Game {
	readonly canvas: HTMLCanvasElement;
	readonly renderer: Renderer;
	readonly wind = new Wind();
	readonly particles = new Particles(3200);
	cb: GameCallbacks;

	cloth: Cloth | null = null;
	level: LevelDef | null = null;
	private env: EnvDef = ENVS.studio;
	private fabric: Fabric = getFabric("cotton");
	private staticProps: Prop[] = [];
	private threadCol: [number, number, number] = [1, 1, 1];

	// view
	private cssW = 1;
	private cssH = 1;
	private insetTop = 64;
	private insetBottom = 104;
	private portrait = false;
	private view = mat4();
	private proj = mat4();
	private camPos: [number, number, number] = [0, 1, 3];
	private camFwd: [number, number, number] = [0, 0, -1];
	private topY = 1.4;
	private clothW = 1;
	private artRect: { cx: number; cy: number; z: number; w: number; h: number } | null = null;

	// time
	private raf = 0;
	private last = 0;
	private acc = 0;
	private time = 0;
	private running = false;
	private paused = false;
	private slowmo = false;
	private hitstop = 0;
	private windScale = 1;
	private gravScale = 1;
	private frameMs = 16;
	private lastInput = 0;
	private pauseTick = 0;
	private hiddenStop = false;
	private slowFrames = 0;
	private fpsAcc = 0;
	private fpsN = 0;
	private fps = 60;
	tier: QualityTier;
	private autoQuality = true;

	// play
	tool: ToolId = "hand";
	private ptrs = new Map<number, Ptr>();
	private crackers: Cracker[] = [];
	private state: "idle" | "playing" | "done" | "failed" = "idle";
	private started = false;
	private stats: RunStats = blankStats();
	private left: Partial<Record<ToolId, number>> = {};
	private checkAcc = 0;
	private doneTimer = -1;
	private exhausted = 0;
	private progress = 0;
	private readout = "";
	private guard = -1;
	private initialSplits = 0;
	private hudAcc = 0;
	private lastHint = 0;
	private lastSnip = 0;
	private lastCreak = 0;
	private cutThisStroke = false;
	private cover = new Uint8Array(40 * 30);

	// fx
	private shake = 0;
	private fade = 1;
	private fadeTo = 0;
	private flash = 0;
	private fireI = 0;
	private fire: [number, number, number] = [0, 0, 0];
	private boomLight = 0;
	private boomPos: [number, number, number] = [0, 0, 0];
	private torchOn = false;
	private torchPos: [number, number, number] = [0, 0, 0];
	private moteTarget = 46;
	private haptics = true;
	private gentleControls = false;
	private reducedMotion = false;
	private unbind: Array<() => void> = [];
	private frame: Frame = {
		time: 0,
		shakeX: 0,
		shakeY: 0,
		fade: 1,
		flash: 0,
		flicker: 1,
		fireX: 0,
		fireY: 0,
		fireZ: 0,
		fireR: 1,
		fireG: 0.45,
		fireB: 0.12,
		fireI: 0,
	};

	constructor(canvas: HTMLCanvasElement, cb: GameCallbacks = {}, tier?: QualityTier) {
		this.canvas = canvas;
		this.cb = cb;
		this.tier = tier ?? "medium";
		this.autoQuality = !tier;
		this.renderer = new Renderer(canvas, QUALITY[this.tier]);
		this.bindInput();
		const vis = () => {
			if (document.hidden) {
				this.releaseAll();
				if (this.running) {
					this.hiddenStop = true;
					this.stop();
					audio.suspend();
				}
			} else if (this.hiddenStop) {
				this.hiddenStop = false;
				this.start();
			}
		};
		document.addEventListener("visibilitychange", vis);
		this.unbind.push(() => document.removeEventListener("visibilitychange", vis));
	}

	// ════════════════════════════════════════════════════════════
	//  lifecycle
	// ════════════════════════════════════════════════════════════

	start() {
		if (this.running) return;
		this.running = true;
		this.last = performance.now();
		this.lastInput = this.last;
		this.raf = requestAnimationFrame(this.loop);
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this.raf);
	}

	dispose() {
		this.stop();
		for (const u of this.unbind) u();
		this.unbind = [];
		audio.setFire(0);
		audio.setSpray(false);
		audio.setBlower(false);
		audio.setTorch(false);
	}

	setPaused(p: boolean) {
		this.paused = p;
		this.acc = 0;
		this.last = performance.now();
		if (p) this.releaseAll();
	}

	setHaptics(on: boolean) {
		this.haptics = on;
	}

	setControls(gentle: boolean, reducedMotion: boolean) {
		this.gentleControls = gentle;
		this.reducedMotion = reducedMotion;
		if (this.cloth) this.cloth.pullThreshold = gentle ? 0.18 : 0.1;
	}

	setQuality(tier: QualityTier | "auto") {
		this.autoQuality = tier === "auto";
		if (tier !== "auto" && tier !== this.tier) {
			this.tier = tier;
			this.renderer.setQuality(QUALITY[tier]);
			this.resize(this.cssW, this.cssH);
		}
	}

	/** Sandbox dials. */
	setWindScale(v: number) {
		this.windScale = Number.isFinite(v) ? clamp(v, 0, 100) : 0;
		this.applyWind();
	}
	setGravityScale(v: number) {
		this.gravScale = v;
		if (this.cloth) this.cloth.gravity = -9.81 * v;
	}
	setSlowmo(on: boolean) {
		this.slowmo = on;
	}

	setTool(t: ToolId) {
		if (t === this.tool) return;
		this.releaseAll();
		this.tool = t;
	}

	/** Screen space the UI covers (px): the cloth is framed between the two. */
	setInsets(top: number, bottom: number) {
		if (Math.abs(top - this.insetTop) < 2 && Math.abs(bottom - this.insetBottom) < 2) return;
		this.insetTop = top;
		this.insetBottom = bottom;
		this.frameCamera();
	}

	resize(cssW: number, cssH: number) {
		this.cssW = Math.max(1, cssW);
		this.cssH = Math.max(1, cssH);
		this.portrait = this.cssW / this.cssH < 0.85;
		this.renderer.resize(this.cssW, this.cssH, window.devicePixelRatio || 1);
		// Reframe the existing cloth; rotation must not erase a run or sandbox edits.
		this.releaseAll();
		this.frameCamera();
	}

	private fx(pattern: number | number[]) {
		if (this.haptics) haptic(pattern);
	}

	// ════════════════════════════════════════════════════════════
	//  scene
	// ════════════════════════════════════════════════════════════

	load(level: LevelDef, fadeIn = true) {
		this.releaseAll();
		this.level = level;
		const env = ENVS[level.env];
		this.env = env;
		const def = level.cloth;
		const fabric = getFabric(def.fabric);
		this.fabric = fabric;
		this.threadCol = hexToLinear(def.dye ?? fabric.look.thread);

		const size = this.portrait && def.tall ? def.tall : { w: def.w, h: def.h };
		const cols = Math.max(6, Math.round(size.w / CELL));
		const rows = Math.max(6, Math.round(size.h / CELL));
		const w = cols * CELL,
			h = rows * CELL;
		const gap = def.gap ?? 0.26;
		const topY = gap + h;
		this.topY = topY;
		this.clothW = w;

		const lay = buildLayout(cols, rows, w, h, 0, topY, 0, def.mount);
		const cloth = new Cloth({
			cols,
			rows,
			width: w,
			height: h,
			fabric,
			positions: lay.positions,
			pins: lay.pins,
			floorY: 0,
			wallZ: env.wallZ,
		});
		cloth.pullThreshold = this.gentleControls ? 0.18 : 0.1;
		cloth.gravity = -9.81 * this.gravScale;
		this.cloth = cloth;

		if (def.target) {
			const poly = shapePolygon(def.target, w / h);
			cloth.tagRegion((u, v) => insidePolygon(poly, u, v));
		}

		// damage or soaking the level starts with — done in flat uv space
		if (level.pre) {
			for (let p = 0; p < cloth.np; p++) {
				cloth.scr[p * 2] = cloth.uv[p * 2] * 1000;
				cloth.scr[p * 2 + 1] = cloth.uv[p * 2 + 1] * 1000;
			}
			for (const op of level.pre) {
				if (op.op === "cut") {
					cloth.beginStroke();
					for (let i = 1; i < op.pts.length; i++)
						cloth.cutSegment(
							op.pts[i - 1][0] * 1000,
							op.pts[i - 1][1] * 1000,
							op.pts[i][0] * 1000,
							op.pts[i][1] * 1000,
							0.9,
						);
				} else {
					cloth.wetAt(op.u * 1000, op.v * 1000, op.r * 1000, 1.6);
				}
			}
			cloth.cutCount = 0;
			cloth.evN = 0;
			cloth.refreshMass();
		}

		this.windScale = level.wind ?? 1;
		this.applyWind();
		this.wind.time = 0;
		cloth.settle(level.pre ? 1.6 : 1.1, this.wind);
		// soaked patches should still be wet when play begins
		if (level.pre) for (const op of level.pre) if (op.op === "wet") this.rewet(op.u, op.v, op.r);
		this.initialSplits = cloth.countSplits();

		// hardware and scenery
		const metal = env.id === "theatre" || env.id === "studio" || env.id === "forge";
		this.staticProps = mountProps(def.mount, lay, {
			cx: 0,
			topY,
			z: 0,
			w,
			h,
			wallZ: env.wallZ,
			metal,
		});
		this.artRect = null;
		if (level.art) {
			const aw = w * 0.78,
				ah = h * 0.78;
			const cy = topY - h * 0.52;
			const z = -0.11;
			this.artRect = { cx: 0, cy, z, w: aw, h: ah };
			this.staticProps.push(...artProps(0, cy, z, aw, ah));
			this.renderer.setArt(paintArt(level.art, aw / ah), compose(mat4(), 0, cy, z, aw, ah, 0.012), [
				aw,
				ah,
				0.012,
			]);
			cloth.colliders.push({
				kind: "box",
				x: 0,
				y: cy,
				z: z - 0.01,
				hx: aw / 2 + 0.05,
				hy: ah / 2 + 0.05,
				hz: 0.03,
			});
		} else this.renderer.setArt(null);
		this.rebuildProps();

		this.renderer.setEnvironment(
			env,
			{ cx: 0, cy: topY - h / 2, hw: w / 2, hh: h / 2 },
			(level.world * 7 + level.n * 3) % 17,
		);
		this.renderer.setCloth(cloth, drawPrint(def.print, w, h), def.dye);
		this.frameCamera();

		// fresh run
		this.particles.clear();
		this.particles.floorY = 0;
		this.crackers = [];
		this.stats = blankStats();
		this.left = { ...(level.limits ?? {}) };
		this.state = level.objective.type === "sandbox" ? "idle" : "playing";
		this.started = false;
		this.doneTimer = -1;
		this.exhausted = 0;
		this.progress = 0;
		this.guard = -1;
		this.shake = 0;
		this.flash = 0;
		this.hitstop = 0;
		this.boomLight = 0;
		this.acc = 0;
		if (!level.tools.includes(this.tool)) this.tool = level.tools[0];
		if (fadeIn) {
			this.fade = 1;
			this.fadeTo = 0;
		}
		audio.setAmbience(env.id);
		this.evaluate();
		this.pushHud();
		this.last = performance.now();
		this.lastInput = this.last;
	}

	private rewet(u: number, v: number, r: number) {
		const c = this.cloth;
		if (!c) return;
		for (let p = 0; p < c.np; p++) {
			const du = c.uv[p * 2] - u,
				dv = (c.uv[p * 2 + 1] - v) * (c.height / c.width);
			if (du * du + dv * dv < r * r) c.wet[p] = 1;
		}
		c.refreshMass();
	}

	private applyWind() {
		const w = this.env.wind;
		const s = this.windScale;
		this.wind.set(w[0] * s, 0, w[1] * s, w[2], w[3] * Math.min(2, s));
		this.particles.windX = w[0] * s * 0.35;
		this.particles.windZ = w[1] * s * 0.35;
	}

	private rebuildProps() {
		const c = this.cloth;
		const pins: number[] = [];
		if (c)
			for (let p = 0; p < c.np; p++)
				if (c.alive[p] && c.pin[p] === PIN_USER)
					pins.push(c.pos[p * 3], c.pos[p * 3 + 1], c.pos[p * 3 + 2]);
		this.renderer.props = pins.length ? this.staticProps.concat(pinProps(pins)) : this.staticProps;
	}

	/** Fit the cloth, its mount and a strip of floor between the top bar and the tool dock. */
	private frameCamera() {
		const W = this.cssW,
			H = this.cssH;
		const aspect = W / H;
		const top = this.topY + 0.14;
		const bottom = -0.06;
		const a = 1 - (2 * this.insetTop) / H,
			b = 1 - (2 * this.insetBottom) / H;
		let hh = (top - bottom) / Math.max(0.5, a + b);
		const mount = this.level?.cloth.mount.kind;
		const side = mount === "line" ? 0.2 : mount === "pole" ? 0.22 : 0.16;
		hh = Math.max(hh, (this.clothW / 2 + side) / aspect);
		const yc = (top + bottom) / 2 + ((this.insetTop - this.insetBottom) / H) * hh;
		const dist = hh / Math.tan(FOV / 2);
		const cx = mount === "pole" ? -0.02 : 0;
		this.camPos = [cx, yc + hh * 0.16, dist];
		lookAt(this.view, this.camPos, [cx, yc, 0], [0, 1, 0]);
		perspective(this.proj, FOV, aspect, 0.2, 40);
		const fx = cx - this.camPos[0],
			fy = yc - this.camPos[1],
			fz = -this.camPos[2];
		const fl = Math.hypot(fx, fy, fz);
		this.camFwd = [fx / fl, fy / fl, fz / fl];
		this.renderer.setCamera(this.view, this.proj, this.camPos);
	}

	// ════════════════════════════════════════════════════════════
	//  loop
	// ════════════════════════════════════════════════════════════

	private loop = (now: number) => {
		if (!this.running) return;
		this.raf = requestAnimationFrame(this.loop);
		// Pacing, to keep phones cool and batteries alive:
		//  · never draw faster than 60 fps, whatever the display refresh
		//  · a paused game redraws a few times a second
		//  · when nothing is being touched and nothing is burning, drop to 30 fps
		if (now - this.last < 1000 / 60 - 0.5) return;
		if (this.paused && ++this.pauseTick % 12 !== 0) {
			this.last = now;
			return;
		}
		const c0 = this.cloth;
		const busy =
			this.ptrs.size > 0 ||
			now - this.lastInput < 2500 ||
			(c0 !== null && c0.nBurning > 0) ||
			this.crackers.length > 0 ||
			this.doneTimer >= 0 ||
			Math.abs(this.fade - this.fadeTo) > 0.01 ||
			this.shake > 0;
		if (!busy && now - this.last < 1000 / 30 - 0.5) return;
		const raw = now - this.last;
		this.last = now;
		const dt = Math.min(0.05, raw / 1000);
		this.frameMs += (raw - this.frameMs) * 0.05;
		this.fpsAcc += raw;
		if (++this.fpsN >= 30) {
			this.fps = Math.round(30000 / this.fpsAcc);
			this.fpsAcc = 0;
			this.fpsN = 0;
		}
		if (busy) this.adapt(raw);

		const cloth = this.cloth;
		// dip to black quickly, come back up gently
		this.fade += (this.fadeTo - this.fade) * Math.min(1, dt * (this.fadeTo > this.fade ? 11 : 4));
		if (cloth && !this.paused) {
			let simDt = dt * (this.slowmo ? 0.28 : 1);
			if (this.hitstop > 0) {
				this.hitstop -= dt;
				simDt = 0;
			}
			this.time += simDt;
			this.wind.update(simDt);
			this.acc += simDt;
			let steps = Math.floor(this.acc / DT);
			if (steps > MAX_STEPS) {
				steps = MAX_STEPS;
				this.acc = 0;
			} else this.acc -= steps * DT;
			if (steps > 0) {
				this.heldTools(simDt);
				cloth.prepare(this.wind);
				for (let s = 0; s < steps; s++) cloth.substep();
				cloth.updateState(simDt);
				this.updateCrackers(simDt);
				this.drainEvents();
				this.ambient(simDt);
				this.particles.update(simDt, this.time);
			}
			if (this.started && this.state === "playing") this.stats.time += simDt;
			this.checkAcc += dt;
			if (this.checkAcc > 0.16) {
				this.checkAcc = 0;
				this.evaluate();
			}
			this.hudAcc += dt;
			if (this.hudAcc > 0.1) {
				this.hudAcc = 0;
				this.pushHud();
			}
			if (this.doneTimer >= 0) {
				this.doneTimer -= dt;
				if (this.doneTimer < 0) this.finish();
			}
		}

		// effects that decay in real time
		this.shake *= 0.002 ** dt;
		if (this.shake < 0.0002) this.shake = 0;
		this.flash *= 0.0005 ** dt;
		this.boomLight *= 0.001 ** dt;
		const f = this.frame;
		f.time = this.time;
		f.shakeX = !this.reducedMotion && this.shake ? rand(-this.shake, this.shake) : 0;
		f.shakeY = !this.reducedMotion && this.shake ? rand(-this.shake, this.shake) : 0;
		f.fade = clamp(this.fade, 0, 1);
		f.flash = this.reducedMotion ? 0 : this.flash;
		f.flicker = this.env.flicker
			? 1 +
				0.16 * Math.sin(this.time * 11) * Math.sin(this.time * 4.3) +
				0.07 * Math.sin(this.time * 27)
			: 1;
		this.lightFrame(f);
		this.renderer.render(f, this.particles);
	};

	/** Step the render quality down if this device can't hold a smooth frame rate. */
	private adapt(raw: number) {
		if (!this.autoQuality || this.tier === "low" || this.paused) return;
		if (raw > 26 && raw < 200) this.slowFrames += 2;
		else if (this.slowFrames > 0) this.slowFrames--;
		if (this.slowFrames > 180) {
			this.slowFrames = 0;
			this.tier = this.tier === "high" ? "medium" : "low";
			this.renderer.setQuality(QUALITY[this.tier]);
			this.renderer.resize(this.cssW, this.cssH, window.devicePixelRatio || 1);
			this.cb.onQuality?.(this.tier);
		}
	}

	/** One moving light for whatever is burning brightest: fire, torch or blast. */
	private lightFrame(f: Frame) {
		const c = this.cloth;
		let i = 0;
		if (c && c.nBurning > 0) {
			let sx = 0,
				sy = 0,
				sz = 0,
				n = 0;
			const step = Math.max(1, (c.np / 60) | 0);
			for (let p = 0; p < c.np; p += step) {
				if (!c.burning[p]) continue;
				sx += c.pos[p * 3];
				sy += c.pos[p * 3 + 1];
				sz += c.pos[p * 3 + 2];
				n++;
			}
			if (n) {
				const k = 0.12;
				this.fire[0] += (sx / n - this.fire[0]) * k;
				this.fire[1] += (sy / n - this.fire[1]) * k;
				this.fire[2] += (sz / n + 0.12 - this.fire[2]) * k;
			}
			i =
				Math.min(1.6, 0.35 + Math.sqrt(c.nBurning) * 0.14) *
				(0.8 + 0.2 * Math.sin(this.time * 31) * Math.sin(this.time * 13));
		} else if (this.torchOn) {
			this.fire = [this.torchPos[0], this.torchPos[1], this.torchPos[2] + 0.1];
			i = 0.45 + 0.1 * Math.sin(this.time * 40);
		}
		this.fireI += (i - this.fireI) * 0.2;
		if (this.boomLight > 0.02 && this.boomLight > this.fireI) {
			f.fireX = this.boomPos[0];
			f.fireY = this.boomPos[1];
			f.fireZ = this.boomPos[2] + 0.15;
			f.fireI = this.boomLight;
		} else {
			f.fireX = this.fire[0];
			f.fireY = this.fire[1];
			f.fireZ = this.fire[2];
			f.fireI = this.fireI;
		}
		audio.setFire(c ? Math.min(1, c.nBurning / 70) : 0);
		audio.setWind(this.wind.speed);
	}

	// ════════════════════════════════════════════════════════════
	//  input
	// ════════════════════════════════════════════════════════════

	private bindInput() {
		const cv = this.canvas;
		const pos = (e: PointerEvent) => {
			const r = cv.getBoundingClientRect();
			return [e.clientX - r.left, e.clientY - r.top];
		};
		const down = (e: PointerEvent) => {
			audio.wake();
			this.lastInput = performance.now();
			if (this.paused || !this.cloth || this.state === "done" || this.state === "failed") return;
			if (e.pointerType === "mouse" && e.button !== 0) return;
			// only the hand is multi-touch; every other tool follows the first finger
			if (this.tool !== "hand" && this.ptrs.size > 0) return;
			const [x, y] = pos(e);
			const p: Ptr = {
				id: e.pointerId,
				x,
				y,
				px: x,
				py: y,
				vx: 0,
				vy: 0,
				t: performance.now(),
				downX: x,
				downY: y,
				travel: 0,
				grab: null,
				plx: 0,
				ply: 0,
				plz: 0,
				cut: false,
			};
			this.ptrs.set(e.pointerId, p);
			try {
				cv.setPointerCapture(e.pointerId);
			} catch {
				/* not capturable */
			}
			if (!this.started && this.state === "playing") this.started = true;
			this.toolDown(p);
		};
		const move = (e: PointerEvent) => {
			const p = this.ptrs.get(e.pointerId);
			if (!p) return;
			const [x, y] = pos(e);
			const now = performance.now();
			this.lastInput = now;
			const dt = Math.max(4, now - p.t);
			p.vx = p.vx * 0.5 + ((x - p.x) / dt) * 500;
			p.vy = p.vy * 0.5 + ((y - p.y) / dt) * 500;
			p.t = now;
			p.px = p.x;
			p.py = p.y;
			p.x = x;
			p.y = y;
			p.travel += Math.hypot(x - p.px, y - p.py);
			if (!this.paused) this.toolMove(p);
		};
		const up = (e: PointerEvent) => {
			const p = this.ptrs.get(e.pointerId);
			if (!p) return;
			this.ptrs.delete(e.pointerId);
			this.toolUp(p);
		};
		const cancel = (e: PointerEvent) => {
			const p = this.ptrs.get(e.pointerId);
			if (!p) return;
			this.ptrs.delete(e.pointerId);
			this.toolUp(p, true);
		};
		const ctx = (e: Event) => e.preventDefault();
		const blur = () => this.releaseAll();
		cv.addEventListener("pointerdown", down);
		cv.addEventListener("pointermove", move);
		cv.addEventListener("pointerup", up);
		cv.addEventListener("pointercancel", cancel);
		cv.addEventListener("lostpointercapture", cancel);
		cv.addEventListener("contextmenu", ctx);
		window.addEventListener("blur", blur);
		this.unbind.push(
			() => cv.removeEventListener("pointerdown", down),
			() => cv.removeEventListener("pointermove", move),
			() => cv.removeEventListener("pointerup", up),
			() => cv.removeEventListener("pointercancel", cancel),
			() => cv.removeEventListener("lostpointercapture", cancel),
			() => cv.removeEventListener("contextmenu", ctx),
			() => window.removeEventListener("blur", blur),
		);
	}

	private releaseAll() {
		const pointers = [...this.ptrs.values()];
		this.ptrs.clear();
		for (const p of pointers) this.toolUp(p, true);
	}

	/** World-space ray through a screen point. */
	private ray(x: number, y: number, out: Float32Array) {
		const m = this.renderer.invVp;
		const nx = (x / this.cssW) * 2 - 1,
			ny = 1 - (y / this.cssH) * 2;
		const w0 = m[3] * nx + m[7] * ny - m[11] + m[15];
		const ax = (m[0] * nx + m[4] * ny - m[8] + m[12]) / w0,
			ay = (m[1] * nx + m[5] * ny - m[9] + m[13]) / w0,
			az = (m[2] * nx + m[6] * ny - m[10] + m[14]) / w0;
		const w1 = m[3] * nx + m[7] * ny + m[11] + m[15];
		const bx = (m[0] * nx + m[4] * ny + m[8] + m[12]) / w1,
			by = (m[1] * nx + m[5] * ny + m[9] + m[13]) / w1,
			bz = (m[2] * nx + m[6] * ny + m[10] + m[14]) / w1;
		const l = Math.hypot(bx - ax, by - ay, bz - az) || 1;
		out[0] = this.camPos[0];
		out[1] = this.camPos[1];
		out[2] = this.camPos[2];
		out[3] = (bx - ax) / l;
		out[4] = (by - ay) / l;
		out[5] = (bz - az) / l;
	}

	private rayBuf = new Float32Array(6);
	private hit = new Float32Array(3);

	/** Where a screen point touches the cloth; falls back to the cloth's rest plane. Returns true on a real hit. */
	private pick(x: number, y: number): boolean {
		const c = this.cloth;
		const r = this.rayBuf;
		this.ray(x, y, r);
		let t = c ? c.raycast(r[0], r[1], r[2], r[3], r[4], r[5]) : -1;
		const real = t > 0;
		if (!real) t = r[5] !== 0 ? -r[2] / r[5] : 3;
		this.hit[0] = r[0] + r[3] * t;
		this.hit[1] = r[1] + r[4] * t;
		this.hit[2] = r[2] + r[5] * t;
		return real;
	}

	private project() {
		this.cloth?.project(this.renderer.vp, this.cssW, this.cssH);
	}

	private canUse(tool: ToolId): boolean {
		const l = this.left[tool];
		if (l === undefined || l > 0) return true;
		this.hint(`Out of ${TOOLS[tool].name.toLowerCase()}`);
		return false;
	}

	private spend(tool: ToolId, amount: number) {
		this.stats.used[tool] = (this.stats.used[tool] ?? 0) + amount;
		const l = this.left[tool];
		if (l !== undefined) this.left[tool] = Math.max(0, l - amount);
	}

	private hint(msg: string) {
		const now = performance.now();
		if (now - this.lastHint < 2500) return;
		this.lastHint = now;
		this.cb.onHint?.(msg);
	}

	private toolDown(p: Ptr) {
		const c = this.cloth;
		if (!c) return;
		const tool = this.tool;
		if (!this.canUse(tool)) return;
		switch (tool) {
			case "hand": {
				let real = this.pick(p.x, p.y);
				if (!real) {
					// forgiving grab: a near miss still takes hold of the closest cloth
					this.project();
					const n = c.pickScreen(p.x, p.y, 20);
					if (n >= 0) {
						this.hit[0] = c.pos[n * 3];
						this.hit[1] = c.pos[n * 3 + 1];
						this.hit[2] = c.pos[n * 3 + 2];
						real = true;
					}
				}
				if (real) {
					p.grab = c.grab(this.hit[0], this.hit[1], this.hit[2], CELL * 2.1);
					p.plx = this.hit[0];
					p.ply = this.hit[1];
					p.plz = this.hit[2];
					if (p.grab) this.fx(6);
				}
				break;
			}
			case "scissors":
			case "blade":
				c.beginStroke();
				this.cutThisStroke = false;
				break;
			case "torch":
				audio.ignite();
				audio.setTorch(true);
				break;
			case "water":
				audio.setSpray(true);
				break;
			case "blower":
				audio.setBlower(true);
				break;
			case "pin": {
				this.project();
				const n = c.pickScreen(p.x, p.y, 30);
				if (n >= 0) {
					c.togglePin(n);
					this.spend("pin", 1);
					this.rebuildProps();
					audio.pin();
					this.fx(10);
				}
				break;
			}
			case "needle":
				this.sew(p);
				break;
			case "cracker": {
				const real = this.pick(p.x, p.y);
				let n = -1;
				if (real) {
					this.project();
					n = c.pickScreen(p.x, p.y, 40);
				}
				this.crackers.push({
					p: n,
					t: 0.75,
					x: this.hit[0],
					y: this.hit[1],
					z: this.hit[2] + 0.02,
				});
				this.spend("cracker", 1);
				audio.fuse();
				this.fx(8);
				break;
			}
		}
	}

	private toolMove(p: Ptr) {
		const c = this.cloth;
		if (!c) return;
		switch (this.tool) {
			case "hand": {
				if (!p.grab) break;
				// drag in the plane facing the camera through the point first grabbed
				const r = this.rayBuf;
				this.ray(p.x, p.y, r);
				const f = this.camFwd;
				const den = r[3] * f[0] + r[4] * f[1] + r[5] * f[2];
				if (Math.abs(den) < 1e-5) break;
				const t = ((p.plx - r[0]) * f[0] + (p.ply - r[1]) * f[1] + (p.plz - r[2]) * f[2]) / den;
				p.grab.tx = r[0] + r[3] * t;
				p.grab.ty = Math.max(0.02, r[1] + r[4] * t);
				p.grab.tz = r[2] + r[5] * t;
				break;
			}
			case "scissors": {
				if (!this.canUse("scissors")) break;
				const d = Math.hypot(p.x - p.px, p.y - p.py);
				if (d < 0.5) break;
				this.project();
				const n = c.cutSegment(p.px, p.py, p.x, p.y, 0.12);
				if (n) this.afterCut(p, n, false);
				break;
			}
			case "blade": {
				if (!this.canUse("blade")) break;
				const sp = Math.hypot(p.vx, p.vy);
				if (sp < 520) break;
				this.project();
				const n = c.cutSegment(p.px, p.py, p.x, p.y, 0.5);
				if (n) this.afterCut(p, n, true);
				// the wake of the blade
				this.pick(p.x, p.y);
				this.particles.emit(
					P_SPARK,
					this.hit[0],
					this.hit[1],
					this.hit[2] + 0.03,
					0,
					0,
					0,
					0.12,
					0.012,
					1,
					1,
					1,
					0.5,
				);
				break;
			}
			case "needle":
				this.sew(p);
				break;
			default:
				break;
		}
	}

	private afterCut(p: Ptr, n: number, blade: boolean) {
		p.cut = true;
		this.cutThisStroke = true;
		const now = performance.now();
		if (blade) {
			if (now - this.lastSnip > 110) {
				audio.slash(clamp(Math.hypot(p.vx, p.vy) / 2600, 0.2, 1));
				this.lastSnip = now;
				this.fx(12);
			}
		} else if (now - this.lastSnip > 150) {
			audio.snip();
			this.lastSnip = now;
			this.fx(5);
		}
		void n;
	}

	private sew(p: Ptr) {
		const c = this.cloth;
		if (!c) return;
		this.project();
		const m = c.sewAt(p.x, p.y, 38);
		if (m > 0) {
			audio.sew();
			this.fx(4);
			this.spend("needle", 0);
			this.pick(p.x, p.y);
			for (let i = 0; i < 2; i++)
				this.particles.emit(
					P_SPARK,
					this.hit[0],
					this.hit[1],
					this.hit[2] + 0.02,
					rand(-0.3, 0.3),
					rand(0, 0.5),
					rand(0, 0.3),
					0.25,
					0.006,
					0.6,
					1,
					0.7,
					0.8,
				);
		}
	}

	/** `forced`: the pointer was taken away (pause, tool change), not lifted by the player. */
	private toolUp(p: Ptr, forced = false) {
		const c = this.cloth;
		if (p.grab && c) c.release(p.grab);
		p.grab = null;
		if (!c) return;
		const tool = this.tool;
		if (tool === "scissors" || tool === "blade") {
			// a tap with the scissors is a single snip
			if (tool === "scissors" && !forced && p.travel < 8 && this.canUse("scissors")) {
				this.project();
				c.beginStroke();
				const half = (CELL * 1.5 * this.cssH) / (2 * Math.tan(FOV / 2) * this.camPos[2]);
				const n = c.cutSegment(p.x - half, p.y, p.x + half, p.y, 0.12);
				audio.snip();
				if (n) this.cutThisStroke = true;
			}
			if (this.cutThisStroke) {
				this.stats.strokes++;
				this.spend(tool, 1);
				this.cutThisStroke = false;
			}
		}
		if (this.ptrs.size === 0) {
			this.wind.jetOn = false;
			this.torchOn = false;
			audio.setSpray(false);
			audio.setBlower(false);
			audio.setTorch(false);
		}
	}

	/** Tools that act for as long as they are held. */
	private heldTools(dt: number) {
		const c = this.cloth;
		if (!c) return;
		this.torchOn = false;
		this.wind.jetOn = false;
		let creak = 0;
		for (const p of this.ptrs.values()) {
			if (p.grab) {
				if (p.grab.strain > creak) creak = p.grab.strain;
				continue;
			}
			const tool = this.tool;
			if (tool !== "torch" && tool !== "water" && tool !== "blower") continue;
			const l = this.left[tool];
			if (l !== undefined && l <= 0) {
				this.canUse(tool);
				audio.setSpray(false);
				audio.setBlower(false);
				audio.setTorch(false);
				continue;
			}
			this.spend(tool, dt);
			const real = this.pick(p.x, p.y);
			const hx = this.hit[0],
				hy = this.hit[1],
				hz = this.hit[2];
			const pxPerM = this.cssH / (2 * Math.tan(FOV / 2) * this.camPos[2]);
			if (tool === "torch") {
				this.project();
				const lit = c.heatAt(p.x, p.y, 0.07 * pxPerM, dt * 3.4);
				if (lit) {
					audio.ignite();
					this.fx(10);
				}
				this.torchOn = true;
				this.torchPos = [hx, hy, hz];
				// the flame itself
				for (let i = 0; i < 3; i++)
					this.particles.emit(
						P_FLAME,
						hx + rand(-0.012, 0.012),
						hy + rand(-0.01, 0.01),
						hz + 0.03,
						rand(-0.12, 0.12),
						rand(0.3, 0.7),
						rand(0, 0.1),
						rand(0.18, 0.32),
						rand(0.03, 0.05),
						3.2,
						1.9,
						0.7,
						0.9,
					);
				if (!real && Math.random() < dt * 2) this.hint("Hold the flame on the cloth");
				if (c.fabric.flammability <= 0 && real) this.hint(`${c.fabric.name} will not burn`);
			} else if (tool === "water") {
				this.project();
				const out = c.wetAt(p.x, p.y, 0.1 * pxPerM, dt * 2.4);
				if (out) audio.hiss();
				// spray from the nozzle toward the cloth
				const r = this.rayBuf;
				for (let i = 0; i < 4; i++) {
					const sx = hx - r[3] * 0.5 + rand(-0.02, 0.02),
						sy = hy - r[4] * 0.5 + rand(-0.02, 0.02),
						sz = hz - r[5] * 0.5;
					this.particles.emit(
						P_MIST,
						sx,
						sy,
						sz,
						r[3] * 3.4 + rand(-0.5, 0.5),
						r[4] * 3.4 + rand(-0.4, 0.6),
						r[5] * 3.4,
						0.16,
						rand(0.006, 0.012),
						0.75,
						0.88,
						1,
						0.5,
					);
				}
				// the jet pushes the cloth back a little
				this.jet(hx, hy, hz, 5);
			} else {
				this.jet(hx, hy, hz, 17);
				if (Math.random() < dt * 30) {
					const r = this.rayBuf;
					this.particles.emit(
						P_MOTE,
						hx + rand(-0.15, 0.15),
						hy + rand(-0.15, 0.15),
						hz + 0.5,
						r[3] * 6,
						r[4] * 6,
						r[5] * 6,
						0.3,
						0.006,
						0.8,
						0.9,
						1,
						0.5,
					);
				}
			}
		}
		// fibres complaining under a hard pull
		if (creak > 0.12 && this.time - this.lastCreak > 0.09 && Math.random() < 0.4) {
			this.lastCreak = this.time;
			audio.creak();
			if (creak > 0.3 && c.tearCount === this.stats.tears && this.fabric.strength > 5000)
				this.hint(`${this.fabric.name} is too tough to rip bare-handed`);
		}
	}

	private jet(hx: number, hy: number, hz: number, power: number) {
		const r = this.rayBuf;
		const w = this.wind;
		w.jetOn = true;
		w.jx = hx - r[3] * 0.8;
		w.jy = hy - r[4] * 0.8;
		w.jz = hz - r[5] * 0.8;
		w.jdx = r[3];
		w.jdy = r[4];
		w.jdz = r[5];
		w.jetPower = power;
		w.jetRadius = 0.3;
	}

	private updateCrackers(dt: number) {
		const c = this.cloth;
		if (!c) return;
		for (let i = this.crackers.length - 1; i >= 0; i--) {
			const k = this.crackers[i];
			if (k.p >= 0 && c.alive[k.p]) {
				k.x = c.pos[k.p * 3];
				k.y = c.pos[k.p * 3 + 1];
				k.z = c.pos[k.p * 3 + 2] + 0.02;
			}
			k.t -= dt;
			// the fuse spits
			if (Math.random() < dt * 60)
				this.particles.emit(
					P_SPARK,
					k.x,
					k.y,
					k.z,
					rand(-0.8, 0.8),
					rand(0.2, 1.4),
					rand(0, 0.8),
					rand(0.12, 0.3),
					0.006,
					3,
					2.2,
					0.8,
					1,
				);
			this.particles.emit(P_FLAME, k.x, k.y, k.z, 0, 0.1, 0, 0.05, 0.02, 2.5, 0.5, 0.2, 0.9);
			if (k.t <= 0) {
				this.crackers.splice(i, 1);
				this.explode(k.x, k.y, k.z);
			}
		}
	}

	private explode(x: number, y: number, z: number) {
		const c = this.cloth;
		if (!c) return;
		c.explode(x, y, z, 0.3, 46);
		const ps = this.particles;
		ps.emit(P_FLASH, x, y, z + 0.05, 0, 0, 0, 0.16, 0.34, 3.5, 2.6, 1.4, 1);
		for (let i = 0; i < 46; i++) {
			const a = Math.random() * TAU,
				e = rand(-1, 1),
				sp = rand(1.5, 6.5);
			const ce = Math.sqrt(1 - e * e);
			ps.emit(
				P_SPARK,
				x,
				y,
				z,
				Math.cos(a) * ce * sp,
				e * sp + 1,
				Math.abs(Math.sin(a) * ce) * sp * 0.6,
				rand(0.25, 0.7),
				rand(0.004, 0.009),
				3,
				2.2,
				1,
				1,
			);
		}
		for (let i = 0; i < 9; i++)
			ps.emit(
				P_SMOKE,
				x + rand(-0.08, 0.08),
				y + rand(-0.08, 0.08),
				z + 0.04,
				rand(-0.4, 0.4),
				rand(0.2, 0.9),
				rand(0, 0.3),
				rand(0.9, 1.7),
				rand(0.1, 0.2),
				0.16,
				0.15,
				0.15,
				0.55,
			);
		const t = this.threadCol;
		for (let i = 0; i < 24; i++)
			ps.emit(
				P_FIBER,
				x + rand(-0.08, 0.08),
				y + rand(-0.08, 0.08),
				z,
				rand(-2.5, 2.5),
				rand(-1, 3),
				rand(0, 2),
				rand(0.8, 1.8),
				rand(0.012, 0.03),
				t[0] * 0.5,
				t[1] * 0.5,
				t[2] * 0.5,
				1,
			);
		this.shake = 0.014;
		this.flash = 0.5;
		this.hitstop = 0.05;
		this.boomLight = 3.2;
		this.boomPos = [x, y, z];
		audio.boom();
		this.fx([30, 20, 60]);
	}

	// ════════════════════════════════════════════════════════════
	//  effects
	// ════════════════════════════════════════════════════════════

	private drainEvents() {
		const c = this.cloth;
		if (!c) return;
		const ev = c.ev;
		const ps = this.particles;
		const t = this.threadCol;
		let tears = 0,
			mag = 0,
			cuts = 0;
		const mail = c.fabric.look.metal > 0.5;
		for (let i = 0; i < c.evN; i++) {
			const o = i * EV_STRIDE;
			const type = ev[o],
				x = ev[o + 1],
				y = ev[o + 2],
				z = ev[o + 3];
			if (type === EV_TEAR) {
				tears++;
				mag += ev[o + 7];
				if (mail) {
					for (let k = 0; k < 3; k++)
						ps.emit(
							P_SPARK,
							x,
							y,
							z + 0.01,
							rand(-1.6, 1.6),
							rand(-0.5, 2),
							rand(0, 1.2),
							rand(0.15, 0.4),
							0.005,
							3,
							2.4,
							1.2,
							1,
						);
				} else {
					const n = 2 + ((Math.random() * 3) | 0);
					for (let k = 0; k < n; k++)
						ps.emit(
							P_FIBER,
							x + rand(-0.008, 0.008),
							y + rand(-0.008, 0.008),
							z + 0.006,
							ev[o + 4] * rand(-0.6, 0.6) + rand(-0.5, 0.5),
							rand(-0.2, 0.9),
							rand(0.1, 0.7),
							rand(0.5, 1.3),
							rand(0.007, 0.016),
							t[0] * rand(0.5, 0.8),
							t[1] * rand(0.5, 0.8),
							t[2] * rand(0.5, 0.8),
							1,
						);
				}
			} else if (type === EV_CUT) {
				cuts++;
				if (mail)
					for (let k = 0; k < 4; k++)
						ps.emit(
							P_SPARK,
							x,
							y,
							z + 0.01,
							rand(-1.8, 1.8),
							rand(-0.4, 2.2),
							rand(0.2, 1.4),
							rand(0.15, 0.4),
							0.005,
							3,
							2.5,
							1.3,
							1,
						);
				else if (Math.random() < 0.5)
					ps.emit(
						P_FIBER,
						x,
						y,
						z + 0.006,
						rand(-0.3, 0.3),
						rand(-0.1, 0.4),
						rand(0.1, 0.4),
						rand(0.4, 0.9),
						rand(0.005, 0.01),
						t[0] * 0.7,
						t[1] * 0.7,
						t[2] * 0.7,
						1,
					);
			} else if (type === EV_BURN) {
				for (let k = 0; k < 2; k++)
					ps.emit(
						P_EMBER,
						x + rand(-0.02, 0.02),
						y,
						z + 0.01,
						rand(-0.25, 0.25),
						rand(0.2, 0.8),
						rand(-0.1, 0.3),
						rand(0.7, 1.8),
						rand(0.004, 0.008),
						3,
						1.2,
						0.25,
						1,
					);
				if (Math.random() < 0.6)
					ps.emit(
						P_SMOKE,
						x,
						y + 0.02,
						z,
						rand(-0.1, 0.1),
						rand(0.3, 0.6),
						0,
						rand(1.2, 2.2),
						rand(0.05, 0.09),
						0.1,
						0.1,
						0.1,
						0.4,
					);
			} else if (type === EV_STEAM) {
				for (let k = 0; k < 2; k++)
					ps.emit(
						P_STEAM,
						x,
						y,
						z + 0.01,
						rand(-0.15, 0.15),
						rand(0.4, 0.9),
						rand(0, 0.2),
						rand(0.5, 1),
						rand(0.03, 0.06),
						0.9,
						0.93,
						0.96,
						0.35,
					);
				if (Math.random() < 0.3) audio.hiss();
			}
		}
		c.evN = 0;
		if (tears) {
			this.stats.tears = c.tearCount;
			audio.rip(c.fabric.sound, mag / tears, tears);
			if (tears >= 4) {
				// a big rip lands with a beat of stillness
				this.hitstop = Math.max(this.hitstop, Math.min(0.05, 0.012 + tears * 0.004));
				this.shake = Math.max(this.shake, Math.min(0.006, tears * 0.0007));
				this.fx([8, 18, 12]);
			} else this.fx(5);
		}
		if (cuts && mail) audio.rip(c.fabric.sound, 0.4, cuts);

		// things landing on the floor
		if (c.impactN > 3 && c.impactV > 1.2) {
			const v = clamp((c.impactV - 1) / 4, 0.15, 1);
			audio.thud(v);
			const dusty = this.env.id !== "backyard";
			for (let k = 0; k < 4; k++)
				ps.emit(
					P_PUFF,
					c.impactX + rand(-0.1, 0.1),
					0.02,
					c.impactZ + rand(-0.05, 0.05),
					rand(-0.5, 0.5),
					rand(0.05, 0.3),
					rand(-0.1, 0.3),
					rand(0.6, 1.2),
					rand(0.06, 0.12),
					dusty ? 0.5 : 0.3,
					dusty ? 0.46 : 0.36,
					dusty ? 0.4 : 0.2,
					0.16 * v,
				);
		}
		c.impactN = 0;
		c.impactV = 0;
	}

	/** Flames, drips and the motes that hang in each room's air. */
	private ambient(dt: number) {
		const c = this.cloth;
		const ps = this.particles;
		if (!c) return;
		if (c.nBurning > 0) {
			// sample the burning particles; budget stays flat however big the fire
			const want = Math.min(26, 4 + c.nBurning * 0.5);
			const start = (Math.random() * c.np) | 0;
			let made = 0;
			for (let k = 0; k < c.np && made < want; k++) {
				const p = (start + k * 7) % c.np;
				if (!c.burning[p]) continue;
				const x = c.pos[p * 3],
					y = c.pos[p * 3 + 1],
					z = c.pos[p * 3 + 2];
				ps.emit(
					P_FLAME,
					x + rand(-0.015, 0.015),
					y + rand(-0.01, 0.02),
					z + rand(0.005, 0.03),
					rand(-0.12, 0.12),
					rand(0.35, 0.9),
					rand(-0.05, 0.12),
					rand(0.22, 0.5),
					rand(0.035, 0.075),
					3,
					1.6,
					0.45,
					0.85,
				);
				made++;
				if (Math.random() < 0.12)
					ps.emit(
						P_EMBER,
						x,
						y,
						z + 0.02,
						rand(-0.3, 0.3),
						rand(0.4, 1.2),
						rand(-0.1, 0.3),
						rand(0.8, 2.2),
						rand(0.003, 0.007),
						3,
						1.3,
						0.3,
						1,
					);
				if (Math.random() < 0.14)
					ps.emit(
						P_SMOKE,
						x,
						y + 0.08,
						z,
						rand(-0.1, 0.1),
						rand(0.4, 0.8),
						rand(-0.05, 0.05),
						rand(1.4, 2.6),
						rand(0.06, 0.12),
						0.07,
						0.07,
						0.075,
						0.45,
					);
			}
		}
		if (c.anyWet && Math.random() < dt * 24) {
			const p = (Math.random() * c.np) | 0;
			if (c.alive[p] && c.wet[p] > 0.55)
				ps.emit(
					P_DROP,
					c.pos[p * 3],
					c.pos[p * 3 + 1] - 0.005,
					c.pos[p * 3 + 2],
					0,
					-0.1,
					0,
					1.6,
					0.007,
					0.7,
					0.85,
					1,
					0.75,
				);
		}
		// room atmosphere
		if (Math.random() < dt * (this.moteTarget / 6)) {
			const hw = this.clothW * 0.9,
				top = this.topY + 0.3;
			const x = rand(-hw, hw),
				y = rand(0.05, top),
				z = rand(this.env.wallZ * 0.8, 0.7);
			const m = this.env.motes;
			if (m === "dust")
				ps.emit(
					P_MOTE,
					x,
					y,
					z,
					rand(-0.02, 0.02),
					rand(-0.02, 0.01),
					0,
					rand(4, 8),
					rand(0.004, 0.008),
					1,
					0.9,
					0.72,
					0.5,
				);
			else if (m === "pollen")
				ps.emit(
					P_MOTE,
					x,
					y,
					z,
					rand(0.05, 0.2),
					rand(-0.02, 0.04),
					0,
					rand(4, 8),
					rand(0.004, 0.009),
					1,
					1,
					0.8,
					0.55,
				);
			else if (m === "embers")
				ps.emit(
					P_EMBER,
					x,
					rand(0, 0.4),
					z,
					rand(-0.05, 0.1),
					rand(0.15, 0.4),
					0,
					rand(2, 4),
					rand(0.003, 0.006),
					2.5,
					0.9,
					0.2,
					0.9,
				);
			else if (Math.random() < 0.3)
				ps.emit(
					P_PETAL,
					rand(-hw * 1.3, hw),
					top + 0.2,
					z,
					rand(0.1, 0.4),
					rand(-0.3, -0.1),
					0,
					rand(6, 10),
					rand(0.008, 0.014),
					1,
					0.62,
					0.72,
					0.9,
				);
			else
				ps.emit(
					P_MOTE,
					x,
					y,
					z,
					rand(-0.02, 0.02),
					rand(-0.02, 0.01),
					0,
					rand(4, 8),
					rand(0.004, 0.008),
					1,
					0.86,
					0.6,
					0.45,
				);
		}
	}

	private confetti() {
		const ps = this.particles;
		const top = this.topY + 0.35;
		for (let i = 0; i < 150; i++) {
			const col = CONFETTI[(Math.random() * CONFETTI.length) | 0];
			ps.emit(
				P_CONFETTI,
				rand(-this.clothW * 0.7, this.clothW * 0.7),
				top + rand(-0.1, 0.5),
				rand(-0.2, 0.5),
				rand(-0.8, 0.8),
				rand(-0.5, 1.5),
				rand(-0.3, 0.3),
				rand(3.5, 6),
				rand(0.012, 0.022),
				col[0],
				col[1],
				col[2],
				1,
			);
		}
	}

	// ════════════════════════════════════════════════════════════
	//  objectives
	// ════════════════════════════════════════════════════════════

	/** Fraction of the hidden picture no longer covered by cloth, sampled on a coarse grid. */
	private revealed(): number {
		const c = this.cloth;
		const a = this.artRect;
		if (!c || !a) return 0;
		const GW = 40,
			GH = 30;
		const cov = this.cover;
		cov.fill(0);
		// project the picture's corners; treat it as an axis-aligned screen rectangle
		const vp = this.renderer.vp;
		const sx = (x: number, y: number, z: number) => {
			const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
			return [
				((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w + 1) * 0.5 * this.cssW,
				(1 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 * this.cssH,
			];
		};
		const tl = sx(a.cx - a.w / 2, a.cy + a.h / 2, a.z),
			br = sx(a.cx + a.w / 2, a.cy - a.h / 2, a.z);
		const x0 = tl[0],
			y0 = tl[1],
			gw = (br[0] - tl[0]) / GW,
			gh = (br[1] - tl[1]) / GH;
		if (gw <= 0 || gh <= 0) return 0;
		this.project();
		const s = c.scr;
		for (let t = 0; t < c.nt; t++) {
			if (!c.triAlive[t]) continue;
			const i0 = c.tri[t * 3] * 2,
				i1 = c.tri[t * 3 + 1] * 2,
				i2 = c.tri[t * 3 + 2] * 2;
			const ax = (s[i0] - x0) / gw,
				ay = (s[i0 + 1] - y0) / gh,
				bx = (s[i1] - x0) / gw,
				by = (s[i1 + 1] - y0) / gh,
				cx = (s[i2] - x0) / gw,
				cy = (s[i2 + 1] - y0) / gh;
			const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
				maxx = Math.min(GW - 1, Math.floor(Math.max(ax, bx, cx))),
				miny = Math.max(0, Math.floor(Math.min(ay, by, cy))),
				maxy = Math.min(GH - 1, Math.floor(Math.max(ay, by, cy)));
			if (minx > maxx || miny > maxy) continue;
			const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
			if (Math.abs(area) < 1e-6) continue;
			for (let gy = miny; gy <= maxy; gy++)
				for (let gx = minx; gx <= maxx; gx++) {
					const px = gx + 0.5,
						py = gy + 0.5;
					const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area,
						w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area,
						w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / area;
					if (w0 >= 0 && w1 >= 0 && w2 >= 0) cov[gy * GW + gx] = 1;
				}
		}
		let n = 0;
		for (let i = 0; i < GW * GH; i++) n += cov[i];
		return 1 - n / (GW * GH);
	}

	private evaluate() {
		const c = this.cloth;
		const lv = this.level;
		if (!c || !lv) return;
		const o = lv.objective;
		c.analyze(o.type === "pieces" ? c.initialArea * 0.035 : 0);
		const st = this.stats;
		st.pieces = c.pieces;
		st.burnt = c.burntArea / c.initialArea;
		let prog = 0,
			text = "",
			done = false,
			fail = "";
		this.guard = -1;
		switch (o.type) {
			case "pieces":
				prog = clamp((c.pieces - 1) / (o.count - 1), 0, 1);
				text = `${Math.min(c.pieces, o.count)} / ${o.count}`;
				done = c.pieces >= o.count;
				st.quality = 1;
				break;
			case "clear": {
				const cleared = 1 - c.hangingArea / c.initialArea;
				prog = clamp(cleared / o.pct, 0, 1);
				text = `${Math.round(Math.min(1, cleared / o.pct) * 100)}%`;
				done = cleared >= o.pct;
				st.quality = cleared;
				break;
			}
			case "burn": {
				const b = c.burntArea / c.initialArea;
				prog = clamp(b / o.pct, 0, 1);
				text = `${Math.round(prog * 100)}%`;
				done = b >= o.pct;
				st.quality = b;
				// nothing alight and no way to relight it
				if (
					!done &&
					c.nBurning === 0 &&
					this.started &&
					!this.hasFuel("torch") &&
					!this.hasFuel("cracker") &&
					this.crackers.length === 0
				)
					this.exhausted += 0.16;
				else this.exhausted = 0;
				if (this.exhausted > 2.5) fail = "The fire went out";
				break;
			}
			case "cutout": {
				// the piece holding most of the shape
				let best = -1,
					bt = 0,
					alive = 0;
				for (let p = 0; p < c.np; p++) {
					if (!c.alive[p] || c.parent[p] !== p) continue;
					alive += c.compTag[p];
					if (c.compTag[p] > bt) {
						bt = c.compTag[p];
						best = p;
					}
				}
				const recall = c.targetArea > 0 ? bt / c.targetArea : 0;
				const precision = best >= 0 && c.compArea[best] > 0 ? bt / c.compArea[best] : 0;
				const free = best >= 0 && !c.compPin[best];
				st.quality = recall * precision;
				// progress: how close the piece is to being only the shape
				prog =
					clamp(
						(precision - c.targetArea / c.initialArea) / (0.6 - c.targetArea / c.initialArea),
						0,
						1,
					) * (free ? 1 : 0.9);
				text = `${Math.round(precision * recall * 100)}%`;
				done = free && recall >= 0.72 && precision >= 0.6;
				this.guard = clamp(recall, 0, 1);
				if (recall < 0.72 || alive < c.targetArea * 0.72) fail = "The shape was cut apart";
				break;
			}
			case "protect": {
				let tagHang = 0;
				for (let p = 0; p < c.np; p++)
					if (c.alive[p] && c.parent[p] === p && c.compPin[p]) tagHang += c.compTag[p];
				const keep = c.targetArea > 0 ? tagHang / c.targetArea : 1;
				const plain = c.initialArea - c.targetArea;
				const cleared = 1 - (c.hangingArea - tagHang) / plain;
				prog = clamp(cleared / o.clear, 0, 1);
				text = `${Math.round(prog * 100)}%`;
				this.guard = clamp(keep, 0, 1);
				st.quality = keep;
				done = cleared >= o.clear && keep >= o.keep && c.nBurning === 0;
				if (keep < o.keep) fail = "The emblem was lost";
				break;
			}
			case "reveal": {
				const r = this.revealed();
				prog = clamp(r / o.pct, 0, 1);
				text = `${Math.round(prog * 100)}%`;
				done = r >= o.pct;
				st.quality = r;
				break;
			}
			case "mend": {
				const s = c.countSplits();
				prog = this.initialSplits > 0 ? clamp(1 - s / this.initialSplits, 0, 1) : 1;
				text = `${Math.round(prog * 100)}%`;
				done = s <= Math.max(1, this.initialSplits * 0.04) && c.pieces === 1;
				st.quality = prog;
				break;
			}
			default:
				prog = 1 - c.hangingArea / c.initialArea;
				text = `${Math.round(prog * 100)}%`;
				break;
		}
		this.progress = prog;
		this.readout = text;
		if (this.state !== "playing") return;
		if (done && this.doneTimer < 0) {
			this.state = "done";
			this.doneTimer = 0.9;
			this.releaseAll();
			this.confetti();
			audio.win();
			this.fx([20, 40, 20, 40, 90]);
			return;
		}
		if (!fail && lv.timeLimit && st.time >= lv.timeLimit) fail = "Out of time";
		if (!fail && o.type !== "burn" && this.started) {
			// every tool spent and nothing left to try
			const spent = lv.tools.every((t) => (this.left[t] ?? 1) <= 0);
			if (spent && this.crackers.length === 0 && c.nBurning === 0) {
				this.exhausted += 0.16;
				if (this.exhausted > 3) fail = "Nothing left to use";
			} else this.exhausted = 0;
		}
		if (fail) {
			this.state = "failed";
			this.releaseAll();
			audio.fail();
			this.cb.onFail?.(fail);
		}
	}

	/** Does this level offer the tool, with some allowance left? */
	private hasFuel(tool: ToolId): boolean {
		const lv = this.level;
		return !!lv && lv.tools.includes(tool) && (this.left[tool] ?? 1) > 0;
	}

	private finish() {
		const lv = this.level;
		if (!lv) return;
		const s2 = lv.stars[0].test(this.stats),
			s3 = lv.stars[1].test(this.stats);
		const earned: [boolean, boolean, boolean] = [true, s2, s3];
		this.cb.onComplete?.({
			levelId: lv.id,
			stars: 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0),
			earned,
			stats: { ...this.stats, used: { ...this.stats.used } },
		});
	}

	private pushHud() {
		const lv = this.level;
		this.cb.onHud?.({
			progress: this.progress,
			readout: this.readout,
			time: this.stats.time,
			timeLeft: lv?.timeLimit ? Math.max(0, lv.timeLimit - this.stats.time) : null,
			left: { ...this.left },
			guard: this.guard,
			fps: this.fps,
			started: this.started,
		});
	}

	/** Fade the picture out (for screen changes). Resolves when dark. */
	fadeOut(): Promise<void> {
		this.fadeTo = 1;
		return new Promise((r) => setTimeout(r, 260));
	}
}

function blankStats(): RunStats {
	return { time: 0, strokes: 0, tears: 0, quality: 0, pieces: 1, burnt: 0, used: {} };
}
