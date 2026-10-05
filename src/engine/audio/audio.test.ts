import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./audio";

const param = () => ({
	value: 0,
	setTargetAtTime: vi.fn(),
	setValueAtTime: vi.fn(),
	exponentialRampToValueAtTime: vi.fn(),
});
const node = () => ({
	connect: vi.fn().mockReturnThis(),
	disconnect: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	gain: param(),
	frequency: param(),
	Q: param(),
	playbackRate: param(),
	onended: null as (() => void) | null,
});
class Context {
	state = "running";
	currentTime = 0;
	sampleRate = 100;
	destination = {};
	gains: ReturnType<typeof node>[] = [];
	sources: ReturnType<typeof node>[] = [];
	tones: ReturnType<typeof node>[] = [];
	createGain() {
		const n = node();
		this.gains.push(n);
		return n;
	}
	createOscillator() {
		const n = node();
		this.tones.push(n);
		return n;
	}
	createBufferSource() {
		const n = node();
		this.sources.push(n);
		return n;
	}
	createBiquadFilter = node;
	createDynamicsCompressor = () => ({
		...node(),
		threshold: param(),
		ratio: param(),
		attack: param(),
		release: param(),
	});
	createBuffer = () => ({ getChannelData: () => new Float32Array(200) });
	resume = vi.fn(async () => {
		this.state = "running";
	});
	suspend = vi.fn(async () => {
		this.state = "suspended";
	});
	close = vi.fn(async () => {
		this.state = "closed";
	});
}

describe("audio preferences and lifetime", () => {
	let engine: AudioEngine;
	let ctx: Context;
	beforeEach(() => {
		vi.useFakeTimers();
		ctx = new Context();
		vi.stubGlobal("window", {
			AudioContext: vi.fn(() => ctx),
		});
		engine = new AudioEngine();
		engine.setAmbience("backyard");
	});
	afterEach(() => {
		engine.dispose();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
	it("honors saved volume and mute before the first gesture", () => {
		engine.configure({ sound: false, volume: 0.5, ambience: false, music: false });
		engine.wake();
		expect(ctx.gains[0].gain.value).toBe(0);
		engine.configure({ sound: true, volume: 0.5, ambience: false, music: false });
		expect(ctx.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.35, 0, 0.05);
	});
	it("music works independently of ambience and fades out when disabled", () => {
		engine.configure({ sound: true, volume: 0.8, ambience: false, music: true });
		engine.wake();
		vi.advanceTimersByTime(260);
		expect(ctx.tones).toHaveLength(2);
		engine.configure({ sound: true, volume: 0.8, ambience: false, music: false });
		expect(ctx.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.15);
		ctx.currentTime = 5;
		vi.advanceTimersByTime(3000);
		expect(ctx.tones).toHaveLength(2);
	});
	it("suspends background audio and releases completed effects and timers", async () => {
		engine.wake();
		engine.tap();
		const tone = ctx.tones[0];
		tone.onended?.();
		expect(tone.disconnect).toHaveBeenCalledOnce();
		engine.suspend();
		expect(ctx.state).toBe("suspended");
		engine.resume();
		expect(ctx.resume).toHaveBeenCalledOnce();
		engine.dispose();
		expect(ctx.close).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		for (const src of ctx.sources) expect(src.stop).toHaveBeenCalled();
	});
});
