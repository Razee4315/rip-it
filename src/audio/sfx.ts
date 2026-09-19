/** Shared AudioContext — resume on first user gesture (Android suspends otherwise). */

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let sfxLast = 0;
let muted = false;
let sprayNode: { src: AudioBufferSourceNode; g: GainNode } | null = null;
let fanNode: { src: AudioBufferSourceNode; g: GainNode } | null = null;

export function isMuted() {
	return muted;
}
export function setMuted(v: boolean) {
	muted = v;
}

export function ensureAudio() {
	if (actx) return actx;
	try {
		const Ctx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		actx = new Ctx();
		master = actx.createGain();
		master.gain.value = 0.5;
		master.connect(actx.destination);
		const len = actx.sampleRate * 2;
		noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
		const d = noiseBuf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	} catch {
		actx = null;
	}
	return actx;
}

export async function resumeAudio() {
	ensureAudio();
	if (actx && actx.state === "suspended") {
		try {
			await actx.resume();
		} catch {
			/* ignore */
		}
	}
}

function budget() {
	const t = performance.now();
	if (t - sfxLast < 40) return false;
	sfxLast = t;
	return true;
}

type BurstOpts = {
	f: number;
	fTo?: number;
	type?: BiquadFilterType;
	q?: number;
	g: number;
	d: number;
	rate?: number;
};

function burst(o: BurstOpts) {
	if (!actx || !master || !noiseBuf || muted) return;
	const t0 = actx.currentTime;
	const src = actx.createBufferSource();
	src.buffer = noiseBuf;
	src.playbackRate.value = o.rate || 1;
	const f = actx.createBiquadFilter();
	f.type = o.type || "bandpass";
	f.frequency.setValueAtTime(o.f, t0);
	if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t0 + o.d);
	f.Q.value = o.q || 1;
	const g = actx.createGain();
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(o.g, t0 + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
	src.connect(f);
	f.connect(g);
	g.connect(master);
	src.start(t0, Math.random() * 1.2);
	src.stop(t0 + o.d + 0.05);
}

type ToneOpts = {
	f: number;
	fTo?: number;
	w?: OscillatorType;
	g: number;
	d: number;
};

function tone(o: ToneOpts) {
	if (!actx || !master || muted) return;
	const t0 = actx.currentTime;
	const osc = actx.createOscillator();
	osc.type = o.w || "sine";
	osc.frequency.setValueAtTime(o.f, t0);
	if (o.fTo) osc.frequency.exponentialRampToValueAtTime(o.fTo, t0 + o.d);
	const g = actx.createGain();
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(o.g, t0 + 0.006);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
	osc.connect(g);
	g.connect(master);
	osc.start(t0);
	osc.stop(t0 + o.d + 0.05);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function ripSnd(v: number, sndF: number, sndD: number) {
	burst({
		f: sndF * rand(0.85, 1.2),
		fTo: sndF * 0.55,
		q: 1.1,
		g: 0.55 * v,
		d: sndD * rand(0.8, 1.3),
	});
	burst({ f: sndF * 0.4, type: "lowpass", g: 0.3 * v, d: sndD * 0.9 });
}
export function snapSnd(v: number) {
	tone({ f: 340, fTo: 70, w: "triangle", g: 0.5 * v, d: 0.12 });
	burst({ f: 2500, g: 0.3 * v, d: 0.05 });
}
export function tinkSnd() {
	tone({ f: rand(2300, 3400), g: 0.16, d: 0.14 });
	tone({ f: rand(3800, 5200), g: 0.06, d: 0.09 });
}
export function snipSnd() {
	burst({ f: 3600, type: "highpass", g: 0.28, d: 0.03 });
	tone({ f: 2900, g: 0.1, d: 0.04 });
	setTimeout(() => {
		burst({ f: 3000, type: "highpass", g: 0.2, d: 0.025 });
	}, 28);
}
export function whooshSnd(v: number) {
	burst({
		f: 420 + v * 500,
		fTo: 900 + v * 900,
		q: 0.8,
		g: clamp(v * 0.35, 0.05, 0.4),
		d: 0.13,
	});
}
export function fwoofSnd() {
	burst({ f: 900, fTo: 250, type: "lowpass", g: 0.5, d: 0.3 });
}
export function crackleSnd() {
	burst({
		f: rand(1500, 4200),
		type: "highpass",
		g: rand(0.05, 0.16),
		d: rand(0.02, 0.045),
	});
}
export function thudSnd(v: number) {
	tone({ f: 110, fTo: 55, w: "sine", g: 0.4 * v, d: 0.14 });
	burst({ f: 300, type: "lowpass", g: 0.2 * v, d: 0.08 });
}
export function pinSnd() {
	tone({ f: 190, g: 0.2, d: 0.05 });
	burst({ f: 2000, type: "highpass", g: 0.1, d: 0.02 });
}
export function sewSnd() {
	tone({ f: 1900, w: "square", g: 0.05, d: 0.02 });
}
export function steamSnd() {
	burst({ f: 6000, type: "highpass", g: 0.25, d: 0.3 });
}
export function creakSnd() {
	burst({ f: 300, q: 9, g: 0.07, d: 0.06 });
}
export function tryBudget() {
	return budget();
}

export function startSpray() {
	if (!actx || !master || !noiseBuf || sprayNode) return;
	const src = actx.createBufferSource();
	src.buffer = noiseBuf;
	src.loop = true;
	const f = actx.createBiquadFilter();
	f.type = "highpass";
	f.frequency.value = 4500;
	const g = actx.createGain();
	g.gain.value = 0.09;
	src.connect(f);
	f.connect(g);
	g.connect(master);
	src.start();
	sprayNode = { src, g };
}
export function stopSpray() {
	if (sprayNode) {
		try {
			sprayNode.src.stop();
		} catch {
			/* */
		}
		sprayNode = null;
	}
}
export function startFan() {
	if (!actx || !master || !noiseBuf || fanNode) return;
	const src = actx.createBufferSource();
	src.buffer = noiseBuf;
	src.loop = true;
	src.playbackRate.value = 0.7;
	const f = actx.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = 320;
	f.Q.value = 0.6;
	const g = actx.createGain();
	g.gain.value = 0.11;
	src.connect(f);
	f.connect(g);
	g.connect(master);
	src.start();
	fanNode = { src, g };
}
export function stopFan() {
	if (fanNode) {
		try {
			fanNode.src.stop();
		} catch {
			/* */
		}
		fanNode = null;
	}
}
