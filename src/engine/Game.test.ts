import { LEVELS } from "@/game/levels";
import { DEFAULT_SANDBOX, sandboxLevel, titleLevel } from "@/game/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "./Game";
import { Cloth, EV_CUT, EV_STRIDE, EV_TEAR } from "./cloth/Cloth";
import { FABRICS } from "./cloth/fabrics";
import { buildLayout } from "./cloth/layout";
import { P_CONFETTI, P_FIBER, P_SPARK } from "./gfx/particles";

vi.mock("./audio/audio", () => ({ audio: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("./gfx/prints", async (original) => ({
	...(await original<typeof import("./gfx/prints")>()),
	drawPrint: () => null,
}));
vi.mock("./gfx/Renderer", () => ({
	QUALITY: { medium: {}, low: {}, high: {} },
	Renderer: class {
		vp = new Float32Array(16);
		invVp = new Float32Array(16);
		resize = vi.fn();
		setCamera = vi.fn();
		setQuality = vi.fn();
		setCloth = vi.fn();
		setEnvironment = vi.fn();
		setArt = vi.fn();
		render = vi.fn();
	},
}));

class Canvas extends EventTarget {
	getBoundingClientRect() {
		return { left: 0, top: 0 };
	}
	setPointerCapture() {}
}

describe("game controls", () => {
	let game: Game;
	let canvas: Canvas;
	let tick: FrameRequestCallback;
	beforeEach(() => {
		vi.stubGlobal("window", Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
		vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((cb: FrameRequestCallback) => {
				tick = cb;
				return 1;
			}),
		);
		canvas = new Canvas();
		game = new Game(canvas as unknown as HTMLCanvasElement);
		const lay = buildLayout(12, 10, 0.6, 0.5, 0, 1, 0, { kind: "batten" });
		game.cloth = new Cloth({
			cols: 12,
			rows: 10,
			width: 0.6,
			height: 0.5,
			fabric: FABRICS.cotton,
			positions: lay.positions,
			pins: lay.pins,
			floorY: 0,
			wallZ: -1,
		});
		game.level = titleLevel();
	});
	afterEach(() => {
		game.dispose();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});
	const pointer = (canvas: Canvas, type: string) =>
		canvas.dispatchEvent(
			Object.assign(new Event(type), {
				pointerId: 1,
				pointerType: "touch",
				clientX: 200,
				clientY: 200,
				button: 0,
			}),
		);

	it("uses coalesced positions to follow a curved touch stroke", () => {
		game.setTool("scissors");
		const cut = vi.spyOn(game.cloth!, "cutSegment").mockReturnValue(1);
		pointer(canvas, "pointerdown");
		canvas.dispatchEvent(
			Object.assign(new Event("pointermove"), {
				pointerId: 1,
				clientX: 250,
				clientY: 250,
				getCoalescedEvents: () => [
					{ pointerId: 1, clientX: 220, clientY: 200, timeStamp: 10 },
					{ pointerId: 1, clientX: 240, clientY: 220, timeStamp: 20 },
				],
			}),
		);
		expect(cut.mock.calls.map((args) => args.slice(0, 4))).toEqual([
			[200, 200, 220, 200],
			[220, 200, 240, 220],
			[240, 220, 250, 250],
		]);
	});

	it("cuts the final segment delivered only on pointer release", () => {
		game.setTool("scissors");
		const cut = vi.spyOn(game.cloth!, "cutSegment").mockReturnValue(1);
		pointer(canvas, "pointerdown");
		canvas.dispatchEvent(
			Object.assign(new Event("pointerup"), {
				pointerId: 1,
				clientX: 260,
				clientY: 220,
			}),
		);
		expect(cut).toHaveBeenCalledWith(200, 200, 260, 220, 0.12);
	});

	it("a repeated final touch sample does not slow the blade or cut twice", () => {
		game.setTool("blade");
		const cut = vi.spyOn(game.cloth!, "cutSegment").mockReturnValue(1);
		canvas.dispatchEvent(
			Object.assign(Object.defineProperty(new Event("pointerdown"), "timeStamp", { value: 0 }), {
				pointerId: 1,
				pointerType: "touch",
				clientX: 200,
				clientY: 200,
				button: 0,
			}),
		);
		for (let i = 1; i <= 5; i++) {
			const sample = { pointerId: 1, clientX: 200 + i * 16, clientY: 200, timeStamp: i * 16 };
			canvas.dispatchEvent(
				Object.assign(
					Object.defineProperty(new Event("pointermove"), "timeStamp", { value: sample.timeStamp }),
					{
						pointerId: sample.pointerId,
						clientX: sample.clientX,
						clientY: sample.clientY,
						getCoalescedEvents: () => [sample],
					},
				),
			);
		}
		// 1000 px/s crosses the 520 px/s threshold after one filtered sample.
		expect(cut).toHaveBeenCalledTimes(4);
	});

	it("an empty-space tap does not spend a firecracker", () => {
		game.load(sandboxLevel(DEFAULT_SANDBOX));
		game.setTool("cracker");
		vi.spyOn(game.cloth!, "raycast").mockReturnValue(-1);
		const fuse = vi.spyOn(game.cloth!, "explode");
		pointer(canvas, "pointerdown");
		pointer(canvas, "pointerup");
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.start();
		for (let frame = 1; frame <= 60; frame++) tick(frame * 30);
		expect(fuse).not.toHaveBeenCalled();
	});

	it.each(["rod", "pole", "line"] as const)(
		"new %s cloth stays exactly still until interaction",
		(mount) => {
			game.load(sandboxLevel({ ...DEFAULT_SANDBOX, mount }));
			const cloth = game.cloth!;
			const rest = cloth.pos.slice(0, cloth.np * 3);
			const substep = vi.spyOn(cloth, "substep");
			vi.spyOn(performance, "now").mockReturnValue(0);
			game.start();
			for (let frame = 1; frame <= 150; frame++) tick((frame * 1000) / 30);
			expect(cloth.pos.slice(0, cloth.np * 3)).toEqual(rest);
			expect(substep).not.toHaveBeenCalled();
			expect(game.wind.speed).toBe(0);
			expect(game.wind.turb).toBe(0);
			// Explicitly enabling wind wakes physics; a fresh cloth resets it again.
			game.setWindScale(1);
			tick(5100);
			expect(substep).toHaveBeenCalled();
			game.load(sandboxLevel({ ...DEFAULT_SANDBOX, mount }));
			expect(game.wind.speed).toBe(0);
		},
	);

	it("zero wind disables turbulence too, and can be turned back on", () => {
		game.setWindScale(0);
		game.wind.update(1);
		const v = new Float32Array(3);
		game.wind.base(0.7, 0.8, 0.2, v);
		expect(Math.hypot(...v)).toBe(0);
		game.setWindScale(1);
		game.wind.base(0.7, 0.8, 0.2, v);
		expect(Math.hypot(...v)).toBeGreaterThan(0);
	});

	it("large repeated tears never freeze physics or shake the camera", () => {
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.setWindScale(1);
		game.start();
		const c = game.cloth!;
		const step = vi.spyOn(c, "substep");
		const render = vi.mocked(game.renderer.render);
		for (let frame = 1; frame <= 8; frame++) {
			c.evN = 8;
			for (let i = 0; i < c.evN; i++) {
				c.ev[i * EV_STRIDE] = EV_TEAR;
				c.ev[i * EV_STRIDE + 7] = 1;
			}
			step.mockClear();
			tick(frame * 30);
			expect(step.mock.calls.length).toBeGreaterThanOrEqual(21);
			const frameState = render.mock.calls.at(-1)?.[0];
			expect(frameState?.shakeX).toBe(0);
			expect(frameState?.shakeY).toBe(0);
		}
	});

	it.each(["cotton", "mail"] as const)(
		"dense %s tears and cuts have a bounded cosmetic cost",
		(fabric) => {
			game.load(sandboxLevel({ ...DEFAULT_SANDBOX, fabric }));
			game.setQuality("low");
			const c = game.cloth!;
			const emit = vi.spyOn(game.particles, "emit");
			vi.spyOn(Math, "random").mockReturnValue(0.25);
			vi.spyOn(performance, "now").mockReturnValue(0);
			game.start();
			c.evN = 120;
			for (let i = 0; i < c.evN; i++) {
				c.ev[i * EV_STRIDE] = i % 2 ? EV_TEAR : EV_CUT;
				c.ev[i * EV_STRIDE + 7] = 1;
			}
			tick(30);
			const debris = emit.mock.calls.filter((args) => args[0] === P_FIBER || args[0] === P_SPARK);
			expect(debris.length).toBeGreaterThan(0);
			expect(debris.length).toBeLessThanOrEqual(8);
			expect(c.evN).toBe(0);
			for (const args of debris)
				if (args[0] === P_FIBER) expect(args[8]).toBeLessThanOrEqual(0.005);
		},
	);

	it("rotation preserves the same cloth and its cuts", () => {
		game.resize(1200, 800);
		const cloth = game.cloth;
		const load = vi.spyOn(game, "load");
		game.resize(390, 844);
		expect(game.cloth).toBe(cloth);
		expect(load).not.toHaveBeenCalled();
	});

	it.each(["pointercancel", "lostpointercapture"])("%s never makes a scissor snip", (event) => {
		game.setTool("scissors");
		const cut = vi.spyOn(game.cloth!, "cutSegment");
		pointer(canvas, "pointerdown");
		pointer(canvas, event);
		expect(cut).not.toHaveBeenCalled();
	});

	it("pausing releases held tools and disables the blower jet", () => {
		game.setTool("blower");
		pointer(canvas, "pointerdown");
		game.wind.jetOn = true;
		game.setPaused(true);
		expect(game.wind.jetOn).toBe(false);
	});

	it("result particles expire in real time while the cloth and clock stay paused", () => {
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.particles.emit(P_CONFETTI, 0, 2, 0, 0, 0, 0, 1, 0.01, 1, 1, 1);
		const rest = game.cloth!.pos.slice();
		game.setPaused(true);
		game.start();
		for (let frame = 1; frame <= 90; frame++) tick((frame * 1000) / 60);
		expect(game.particles.n).toBe(0);
		expect(game.cloth!.pos).toEqual(rest);
		expect(game.stats.time).toBe(0);
	});

	it("gentle controls increase the deliberate pull distance", () => {
		game.setControls(false, false);
		const normal = game.cloth!.pullThreshold;
		game.setControls(true, true);
		expect(game.cloth!.pullThreshold).toBeGreaterThan(normal);
	});

	it("the last fraction of torch fuel cannot overshoot its budget", () => {
		game.load({ ...sandboxLevel(DEFAULT_SANDBOX), limits: { torch: 0.01 } });
		game.setTool("torch");
		const heat = vi.spyOn(game.cloth!, "heatAt");
		pointer(canvas, "pointerdown");
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.start();
		tick(30);
		tick(60);
		expect(heat).toHaveBeenCalledOnce();
		expect(heat.mock.calls[0][3]).toBeCloseTo(0.034);
	});

	it("a winning piece count remains stable while loose scraps settle", () => {
		game.load(LEVELS[0]);
		const complete = vi.fn();
		game.cb.onComplete = complete;
		let pieces = 2;
		vi.spyOn(game.cloth!, "analyze").mockImplementation(() => {
			game.cloth!.pieces = pieces;
		});
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.start();
		for (let frame = 1; frame <= 6; frame++) tick(frame * 30);
		pieces = 1;
		for (let frame = 7; frame <= 45; frame++) tick(frame * 30);
		expect(complete).toHaveBeenCalledOnce();
		expect(complete.mock.calls[0][0].stats.pieces).toBe(2);
	});

	it("offers a retry when the remaining scraps cannot make enough playable pieces", () => {
		game.load(LEVELS.find((l) => l.id === "1-5")!);
		const fail = vi.fn();
		game.cb.onFail = fail;
		const c = game.cloth!;
		vi.spyOn(c, "analyze").mockImplementation(() => {
			c.pieces = 0;
			c.compArea.fill(0);
			for (let p = 0; p < c.np; p++)
				if (c.alive[p] && c.parent[p] === p) c.compArea[p] = c.initialArea * 0.02;
		});
		pointer(canvas, "pointerdown");
		pointer(canvas, "pointerup");
		vi.spyOn(performance, "now").mockReturnValue(0);
		game.start();
		for (let frame = 1; frame <= 30; frame++) tick(frame * 30);
		expect(fail).toHaveBeenCalledOnce();
		expect(fail).toHaveBeenCalledWith("The pieces became too small. Try shorter pulls");
	});

	it("the soaked band leaves enough dry cloth to finish Wet Blanket in both orientations", () => {
		for (const [w, h] of [
			[375, 667],
			[1280, 800],
		]) {
			game.resize(w, h);
			game.load(LEVELS.find((l) => l.id === "3-2")!);
			const c = game.cloth!;
			let dry = 0;
			for (let t = 0; t < c.nt; t++) {
				const a = c.tri[t * 3],
					b = c.tri[t * 3 + 1],
					d = c.tri[t * 3 + 2];
				if ((c.wet[a] + c.wet[b] + c.wet[d]) / 3 < 0.3) dry += c.triArea[t];
			}
			expect(dry / c.initialArea).toBeGreaterThan(0.6);
		}
	});
});
