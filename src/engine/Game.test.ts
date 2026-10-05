import { titleLevel } from "@/game/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "./Game";
import { Cloth } from "./cloth/Cloth";
import { FABRICS } from "./cloth/fabrics";
import { buildLayout } from "./cloth/layout";

vi.mock("./audio/audio", () => ({ audio: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("./gfx/Renderer", () => ({
	QUALITY: { medium: {}, low: {}, high: {} },
	Renderer: class {
		vp = new Float32Array(16);
		invVp = new Float32Array(16);
		resize = vi.fn();
		setCamera = vi.fn();
		setQuality = vi.fn();
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
	beforeEach(() => {
		vi.stubGlobal("window", Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
		vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
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
