/**
 * Every sound in the game is synthesised live with Web Audio — no samples to download.
 * Rips are built from tiny grains of filtered noise fired per broken fibre, so the sound
 * follows the tear itself: a slow pull crackles, a hard yank roars.
 */
import type { FabricSound } from "../cloth/fabrics";
import type { EnvId } from "../gfx/environments";

type Loop = { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class AudioEngine {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private noise: AudioBuffer | null = null;
	private muted = false;
	private volume = 0.8;
	private ambience = true;
	private music = false;
	private musicBus: GainNode | null = null;
	private nextNote = 0;
	private note = 0;
	private lastGrain = 0;
	private loops: Record<string, Loop> = {};
	private ambTimer: ReturnType<typeof setInterval> | null = null;
	private env: EnvId | null = null;
	private fireLevel = 0;

	/** Must be called from a user gesture at least once. */
	wake() {
		if (!this.ctx) {
			try {
				const Ctor =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				const ctx = new Ctor();
				const comp = ctx.createDynamicsCompressor();
				comp.threshold.value = -16;
				comp.ratio.value = 5;
				comp.attack.value = 0.003;
				comp.release.value = 0.2;
				const master = ctx.createGain();
				master.gain.value = this.muted ? 0 : 0.7 * this.volume;
				master.connect(comp);
				comp.connect(ctx.destination);
				const len = ctx.sampleRate * 2;
				const buf = ctx.createBuffer(1, len, ctx.sampleRate);
				const d = buf.getChannelData(0);
				for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
				this.ctx = ctx;
				this.master = master;
				this.musicBus = ctx.createGain();
				this.musicBus.gain.value = this.music ? 1 : 0;
				this.musicBus.connect(master);
				this.noise = buf;
				if (this.env) this.startAmbience();
			} catch {
				this.ctx = null;
			}
		}
		if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
	}

	setMuted(m: boolean) {
		this.muted = m;
		if (this.master && this.ctx)
			this.master.gain.setTargetAtTime(m ? 0 : 0.7 * this.volume, this.ctx.currentTime, 0.05);
	}

	configure(s: { sound: boolean; volume: number; ambience: boolean; music: boolean }) {
		this.volume = Math.max(0, Math.min(1, s.volume));
		this.ambience = s.ambience;
		this.music = s.music;
		this.setMuted(!s.sound);
		if (this.ctx) {
			this.musicBus?.gain.setTargetAtTime(this.music ? 1 : 0, this.ctx.currentTime, 0.15);
			this.startAmbience();
		}
	}

	dispose() {
		if (this.ambTimer) clearInterval(this.ambTimer);
		this.ambTimer = null;
		for (const loop of Object.values(this.loops)) {
			loop.src.stop();
			loop.src.disconnect();
			loop.filter.disconnect();
			loop.gain.disconnect();
		}
		this.loops = {};
		if (this.ctx) void this.ctx.close().catch(() => {});
		this.ctx = null;
		this.master = null;
		this.musicBus = null;
		this.noise = null;
		this.nextNote = 0;
	}

	resume() {
		if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
	}

	suspend() {
		if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
	}

	// ── building blocks ─────────────────────────────────────────

	private burst(o: {
		f: number;
		fTo?: number;
		q?: number;
		type?: BiquadFilterType;
		g: number;
		d: number;
		a?: number;
		rate?: number;
		delay?: number;
	}) {
		const { ctx, master, noise } = this;
		if (!ctx || !master || !noise || this.muted) return;
		const t0 = ctx.currentTime + (o.delay ?? 0);
		const src = ctx.createBufferSource();
		src.buffer = noise;
		src.playbackRate.value = o.rate ?? 1;
		const f = ctx.createBiquadFilter();
		f.type = o.type ?? "bandpass";
		f.frequency.setValueAtTime(o.f, t0);
		if (o.fTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.fTo), t0 + o.d);
		f.Q.value = o.q ?? 1;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g), t0 + (o.a ?? 0.004));
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
		src.connect(f).connect(g).connect(master);
		src.start(t0, Math.random() * 1.5);
		src.stop(t0 + o.d + 0.03);
		src.onended = () => {
			src.disconnect();
			f.disconnect();
			g.disconnect();
		};
	}

	private tone(o: {
		f: number;
		music?: boolean;
		fTo?: number;
		w?: OscillatorType;
		g: number;
		d: number;
		a?: number;
		delay?: number;
	}) {
		const { ctx, master } = this;
		if (!ctx || !master || this.muted) return;
		const t0 = ctx.currentTime + (o.delay ?? 0);
		const osc = ctx.createOscillator();
		osc.type = o.w ?? "sine";
		osc.frequency.setValueAtTime(o.f, t0);
		if (o.fTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.fTo), t0 + o.d);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g), t0 + (o.a ?? 0.005));
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
		osc.connect(g).connect(o.music && this.musicBus ? this.musicBus : master);
		osc.start(t0);
		osc.stop(t0 + o.d + 0.03);
		osc.onended = () => {
			osc.disconnect();
			g.disconnect();
		};
	}

	private loop(
		name: string,
		type: BiquadFilterType,
		freq: number,
		q: number,
		rate = 1,
	): Loop | null {
		const { ctx, master, noise } = this;
		if (!ctx || !master || !noise) return null;
		let l = this.loops[name];
		if (!l) {
			const src = ctx.createBufferSource();
			src.buffer = noise;
			src.loop = true;
			src.playbackRate.value = rate;
			const filter = ctx.createBiquadFilter();
			filter.type = type;
			filter.frequency.value = freq;
			filter.Q.value = q;
			const gain = ctx.createGain();
			gain.gain.value = 0;
			src.connect(filter).connect(gain).connect(master);
			src.start(0, Math.random());
			l = { src, gain, filter };
			this.loops[name] = l;
		}
		return l;
	}

	private setLoop(
		name: string,
		level: number,
		type: BiquadFilterType,
		freq: number,
		q: number,
		rate = 1,
	) {
		if (!this.ctx) return;
		if (level <= 0 && !this.loops[name]) return;
		const l = this.loop(name, type, freq, q, rate);
		if (!l) return;
		const t = this.ctx.currentTime;
		l.gain.gain.setTargetAtTime(this.muted ? 0 : level, t, 0.08);
		l.filter.frequency.setTargetAtTime(freq, t, 0.1);
	}

	// ── cloth ───────────────────────────────────────────────────

	/** `count` fibres just broke with the given violence (0..1+). */
	rip(s: FabricSound, intensity: number, count: number) {
		if (!this.ctx) return;
		const now = performance.now();
		if (now - this.lastGrain < 12) return;
		this.lastGrain = now;
		const v = Math.min(1, 0.25 + intensity * 0.5 + count * 0.06);
		if (s.kind === "snap") {
			this.tone({ f: rnd(420, 560), fTo: 80, w: "triangle", g: 0.5 * v, d: 0.13 });
			this.burst({ f: 2600, g: 0.3 * v, d: 0.04 });
			return;
		}
		if (s.kind === "clink") {
			const n = Math.min(3, count);
			for (let i = 0; i < n; i++) {
				const f = rnd(2400, 4200);
				this.tone({ f, g: 0.16 * v, d: rnd(0.12, 0.3), delay: i * 0.018 });
				this.tone({ f: f * 1.51, g: 0.07 * v, d: 0.12, delay: i * 0.018 });
			}
			this.burst({ f: 5000, type: "highpass", g: 0.12 * v, d: 0.02 });
			return;
		}
		const n = Math.min(4, 1 + (count >> 1));
		for (let i = 0; i < n; i++) {
			this.burst({
				f: s.freq * rnd(0.7, 1.4),
				fTo: s.freq * rnd(0.45, 0.8),
				q: s.q,
				g: 0.5 * v * rnd(0.6, 1),
				d: s.grain * rnd(0.8, 1.8),
				rate: rnd(0.7, 1.3),
				delay: i * rnd(0.004, 0.012),
			});
		}
		// the body of the rip: lower, a little longer — heavier cloth has more of it
		this.burst({ f: s.freq * 0.32, type: "lowpass", g: 0.28 * v, d: s.grain * 3.2 });
	}

	creak() {
		this.burst({ f: rnd(260, 420), q: 12, g: 0.06, d: 0.07 });
	}

	snip() {
		this.burst({ f: 4200, type: "highpass", g: 0.2, d: 0.028 });
		this.tone({ f: 3100, g: 0.07, d: 0.035 });
		this.burst({ f: 3200, type: "highpass", g: 0.16, d: 0.03, delay: 0.035 });
		this.tone({ f: 1500, fTo: 900, g: 0.05, d: 0.05, delay: 0.035 });
	}

	slash(v: number) {
		this.burst({
			f: 500 + v * 700,
			fTo: 1400 + v * 1600,
			q: 0.9,
			g: 0.12 + v * 0.25,
			d: 0.14,
			a: 0.02,
		});
		this.tone({ f: 5200, fTo: 2600, g: 0.03 + v * 0.03, d: 0.1 });
	}

	thud(v: number) {
		this.tone({ f: 95, fTo: 48, g: 0.3 * v, d: 0.16 });
		this.burst({ f: 260, type: "lowpass", g: 0.2 * v, d: 0.09 });
	}

	pin() {
		this.tone({ f: 220, fTo: 150, g: 0.22, d: 0.06 });
		this.burst({ f: 2400, type: "highpass", g: 0.12, d: 0.02 });
	}

	sew() {
		this.tone({ f: rnd(1700, 2100), w: "triangle", g: 0.07, d: 0.03 });
		this.burst({ f: 3000, q: 4, g: 0.06, d: 0.05, delay: 0.01 });
	}

	ignite() {
		this.burst({ f: 1100, fTo: 240, type: "lowpass", g: 0.4, d: 0.32, a: 0.03 });
	}

	hiss() {
		this.burst({ f: 6500, type: "highpass", g: 0.2, d: 0.35, a: 0.02 });
	}

	fuse() {
		for (let i = 0; i < 8; i++)
			this.burst({ f: rnd(4000, 7000), type: "highpass", g: 0.1, d: 0.05, delay: i * 0.08 });
	}

	boom() {
		this.tone({ f: 130, fTo: 30, g: 1, d: 0.6, a: 0.002 });
		this.burst({ f: 900, fTo: 90, type: "lowpass", g: 0.9, d: 0.5, a: 0.002 });
		this.burst({ f: 3500, type: "highpass", g: 0.4, d: 0.08 });
		for (let i = 0; i < 5; i++)
			this.burst({
				f: rnd(1500, 5000),
				type: "highpass",
				g: 0.1,
				d: 0.04,
				delay: 0.1 + i * rnd(0.03, 0.09),
			});
	}

	// ── continuous ──────────────────────────────────────────────

	/** 0..1 how much is burning. */
	setFire(level: number) {
		this.fireLevel = level;
		this.setLoop("fire", Math.min(0.32, level * 0.4), "bandpass", 520 + level * 300, 0.6, 0.6);
	}
	setWind(level: number) {
		this.setLoop("wind", Math.min(0.16, level * 0.05), "lowpass", 260 + level * 110, 0.4, 0.5);
	}
	setSpray(on: boolean) {
		this.setLoop("spray", on ? 0.1 : 0, "highpass", 4200, 0.5);
	}
	setBlower(on: boolean) {
		this.setLoop("blower", on ? 0.16 : 0, "bandpass", 340, 0.5, 0.7);
	}
	setTorch(on: boolean) {
		this.setLoop("torch", on ? 0.07 : 0, "bandpass", 1500, 0.8, 1.3);
	}

	// ── interface ───────────────────────────────────────────────

	tap() {
		this.tone({ f: 660, fTo: 480, w: "triangle", g: 0.12, d: 0.06 });
	}
	swish() {
		this.burst({ f: 900, fTo: 2600, q: 0.8, g: 0.08, d: 0.16, a: 0.04 });
	}
	star(i: number) {
		const f = [784, 988, 1319][i] ?? 1319;
		this.tone({ f, g: 0.22, d: 0.5 });
		this.tone({ f: f * 2, g: 0.08, d: 0.3 });
		this.tone({ f: f * 3.01, g: 0.03, d: 0.18 });
	}
	win() {
		[523, 659, 784, 1047].forEach((f, i) => {
			this.tone({ f, w: "triangle", g: 0.16, d: 0.5, delay: i * 0.09 });
			this.tone({ f: f * 2, g: 0.05, d: 0.3, delay: i * 0.09 });
		});
	}
	fail() {
		this.tone({ f: 330, fTo: 262, w: "triangle", g: 0.16, d: 0.3 });
		this.tone({ f: 247, fTo: 175, w: "triangle", g: 0.16, d: 0.5, delay: 0.22 });
	}

	// ── ambience ────────────────────────────────────────────────

	setAmbience(env: EnvId | null) {
		if (this.env === env) return;
		this.env = env;
		if (this.ctx) this.startAmbience();
	}

	private startAmbience() {
		if (this.ambTimer) clearInterval(this.ambTimer);
		const env = this.env;
		this.setLoop(
			"room",
			this.ambience ? (env === "forge" ? 0.025 : env ? 0.008 : 0) : 0,
			"lowpass",
			env === "forge" ? 180 : 320,
			0.3,
			0.4,
		);
		if (!env) return;
		this.ambTimer = setInterval(() => {
			if (this.muted || !this.ctx || this.ctx.state !== "running") return;
			if (this.music && this.ctx.currentTime >= this.nextNote) {
				const notes = [220, 329.63, 293.66, 261.63, 220, 261.63, 329.63, 196];
				const f = notes[this.note++ % notes.length];
				this.tone({ f, g: 0.055, d: 2.8, a: 0.16, music: true });
				this.tone({ f: f / 2, g: 0.025, d: 3.2, a: 0.3, music: true });
				this.nextNote = this.ctx.currentTime + 2.4;
			}
			// fire crackle rides on top of the loop
			if (this.fireLevel > 0.01) {
				const n = 1 + Math.round(this.fireLevel * 5);
				for (let i = 0; i < n; i++)
					this.burst({
						f: rnd(1400, 5200),
						type: "highpass",
						g: rnd(0.03, 0.14),
						d: rnd(0.012, 0.04),
						delay: rnd(0, 0.24),
					});
			}
			if (!this.ambience) return;
			const r = Math.random();
			if (env === "backyard" && r < 0.09) {
				// a bird: a few quick downward chirps
				const base = rnd(2600, 4600);
				const n = 2 + ((Math.random() * 4) | 0);
				for (let i = 0; i < n; i++)
					this.tone({
						f: base * rnd(0.95, 1.2),
						fTo: base * rnd(0.6, 0.8),
						g: 0.028,
						d: rnd(0.05, 0.1),
						delay: i * rnd(0.09, 0.14),
					});
			} else if (env === "dojo" && r < 0.06) {
				// wind chime, pentatonic
				const notes = [1047, 1175, 1319, 1568, 1760, 2093];
				const n = 1 + ((Math.random() * 3) | 0);
				for (let i = 0; i < n; i++) {
					const f = notes[(Math.random() * notes.length) | 0];
					this.tone({ f, g: 0.035, d: 1.6, delay: i * rnd(0.12, 0.4) });
					this.tone({ f: f * 2.76, g: 0.01, d: 0.6, delay: i * rnd(0.12, 0.4) });
				}
			} else if (env === "forge" && r < 0.05) {
				// someone at an anvil, far off
				for (let i = 0; i < 2; i++) {
					this.tone({ f: 2100, g: 0.02, d: 0.25, delay: i * 0.38 });
					this.tone({ f: 3270, g: 0.012, d: 0.18, delay: i * 0.38 });
				}
			} else if (env === "theatre" && r < 0.025) {
				// old boards settling
				this.burst({ f: rnd(180, 300), q: 14, g: 0.03, d: 0.18 });
			}
		}, 260);
	}
}

export const audio = new AudioEngine();
