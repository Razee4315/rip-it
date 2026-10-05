import { DEFAULT_SANDBOX, sandboxLevel, titleLevel } from "@/game/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "./Game";
import { Cloth, EV_CUT, EV_STRIDE, EV_TEAR } from "./cloth/Cloth";
import { FABRICS } from "./cloth/fabrics";
import { buildLayout } from "./cloth/layout";
import { P_FIBER, P_SPARK } from "./gfx/particles";

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

	it("gentle controls increase the deliberate pull distance", () => {
		game.setControls(false, false);
		const normal = game.cloth!.pullThreshold;
		game.setControls(true, true);
		expect(game.cloth!.pullThreshold).toBeGreaterThan(normal);
	});
});
