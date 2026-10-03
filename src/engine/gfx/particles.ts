/**
 * CPU particle pool → one instanced draw. Sparks, embers, flame, smoke, steam, water,
 * flying fibres, dust motes, confetti: each kind has its own little physics below.
 */
import { TAU, rand } from "../math";

export const P_SPARK = 0;
export const P_EMBER = 1;
export const P_FLAME = 2;
export const P_SMOKE = 3;
export const P_STEAM = 4;
export const P_DROP = 5;
export const P_FIBER = 6;
export const P_MOTE = 7;
export const P_CONFETTI = 8;
export const P_PETAL = 9;
export const P_MIST = 10;
export const P_FLASH = 11;
export const P_PUFF = 12;

/** floats per live particle in the sim pool */
const S = 16;
/** floats per instance sent to the GPU */
export const INSTANCE_STRIDE = 16;

// sim layout: x y z | vx vy vz | life age | size rot spin | r g b a | kind
const X = 0,
	Y = 1,
	Z = 2,
	VX = 3,
	VY = 4,
	VZ = 5,
	LIFE = 6,
	AGE = 7,
	SIZE = 8,
	ROT = 9,
	SPIN = 10,
	R = 11,
	G = 12,
	B = 13,
	A = 14,
	KIND = 15;

export class Particles {
	readonly max: number;
	n = 0;
	private d: Float32Array;
	readonly out: Float32Array;
	floorY = 0;
	/** ambient air movement nudging the light stuff */
	windX = 0;
	windZ = 0;

	constructor(max = 3200) {
		this.max = max;
		this.d = new Float32Array(max * S);
		this.out = new Float32Array(max * INSTANCE_STRIDE);
	}

	clear() {
		this.n = 0;
	}

	emit(
		kind: number,
		x: number,
		y: number,
		z: number,
		vx: number,
		vy: number,
		vz: number,
		life: number,
		size: number,
		r: number,
		g: number,
		b: number,
		a = 1,
	) {
		let i: number;
		if (this.n < this.max) i = this.n++;
		else {
			// pool full: recycle a random slot rather than dropping new effects on the floor
			i = (Math.random() * this.max) | 0;
			if (this.d[i * S + KIND] === P_MOTE) return;
		}
		const o = i * S;
		const d = this.d;
		d[o + X] = x;
		d[o + Y] = y;
		d[o + Z] = z;
		d[o + VX] = vx;
		d[o + VY] = vy;
		d[o + VZ] = vz;
		d[o + LIFE] = life;
		d[o + AGE] = 0;
		d[o + SIZE] = size;
		d[o + ROT] = Math.random() * TAU;
		d[o + SPIN] = rand(-6, 6);
		d[o + R] = r;
		d[o + G] = g;
		d[o + B] = b;
		d[o + A] = a;
		d[o + KIND] = kind;
	}

	update(dt: number, time: number) {
		const d = this.d;
		const wx = this.windX,
			wz = this.windZ;
		let i = 0;
		while (i < this.n) {
			const o = i * S;
			const age = d[o + AGE] + dt;
			const kind = d[o + KIND];
			let dead = age >= d[o + LIFE];
			if (!dead) {
				d[o + AGE] = age;
				let g = 0,
					drag = 0,
					wind = 0;
				switch (kind) {
					case P_SPARK:
						g = -7;
						drag = 1.2;
						break;
					case P_EMBER:
						g = 0.9;
						drag = 1.6;
						wind = 0.8;
						d[o + VX] += Math.sin(time * 9 + d[o + ROT] * 5) * 1.6 * dt;
						break;
					case P_FLAME:
						g = 3.2;
						drag = 2.4;
						wind = 0.5;
						break;
					case P_SMOKE:
					case P_STEAM:
					case P_PUFF:
						g = kind === P_PUFF ? 0.15 : 0.55;
						drag = 1.4;
						wind = 1;
						break;
					case P_DROP:
					case P_MIST:
						g = -9.8;
						drag = kind === P_MIST ? 3 : 0.2;
						break;
					case P_FIBER:
						g = -1.6;
						drag = 3.2;
						wind = 1;
						d[o + VX] += Math.sin(time * 5 + d[o + ROT] * 9) * 0.8 * dt;
						break;
					case P_MOTE:
						drag = 0.6;
						wind = 0.25;
						d[o + VX] += Math.sin(time * 0.7 + d[o + ROT] * 7) * 0.02 * dt;
						d[o + VY] += Math.cos(time * 0.9 + d[o + ROT] * 3) * 0.02 * dt;
						break;
					case P_CONFETTI:
					case P_PETAL:
						g = kind === P_PETAL ? -0.5 : -2.6;
						drag = 2.2;
						wind = 1;
						d[o + VX] += Math.sin(time * 4 + d[o + ROT] * 4) * 1.3 * dt;
						d[o + VZ] += Math.cos(time * 3.3 + d[o + ROT] * 6) * 0.8 * dt;
						break;
					default:
						break;
				}
				const k = 1 - Math.min(1, drag * dt);
				d[o + VX] = (d[o + VX] - wx * wind) * k + wx * wind;
				d[o + VY] = d[o + VY] * k + g * dt;
				d[o + VZ] = (d[o + VZ] - wz * wind) * k + wz * wind;
				d[o + X] += d[o + VX] * dt;
				d[o + Y] += d[o + VY] * dt;
				d[o + Z] += d[o + VZ] * dt;
				d[o + ROT] += d[o + SPIN] * dt;
				if (d[o + Y] < this.floorY) {
					if (kind === P_DROP || kind === P_MIST || kind === P_SPARK) dead = true;
					else if (kind === P_CONFETTI || kind === P_FIBER || kind === P_PETAL) {
						// settle on the ground and lie there
						d[o + Y] = this.floorY + 0.004;
						d[o + VX] = d[o + VY] = d[o + VZ] = 0;
						d[o + SPIN] = 0;
					}
				}
			}
			if (dead) {
				this.n--;
				if (i !== this.n) d.copyWithin(o, this.n * S, this.n * S + S);
			} else i++;
		}
	}

	/** Write GPU instances; returns how many. */
	fill(): number {
		const d = this.d,
			out = this.out;
		for (let i = 0; i < this.n; i++) {
			const o = i * S,
				q = i * INSTANCE_STRIDE;
			const kind = d[o + KIND];
			const t = d[o + AGE] / d[o + LIFE];
			let size = d[o + SIZE],
				r = d[o + R],
				g = d[o + G],
				b = d[o + B],
				a = d[o + A],
				shape = 0,
				add = 0,
				stretch = 0,
				aspect = 1,
				rot = d[o + ROT];
			switch (kind) {
				case P_SPARK:
					shape = 1;
					add = 1;
					stretch = 0.045;
					aspect = 0.35;
					a *= 1 - t * t;
					// cools from white-hot to red
					g *= 1 - t * 0.6;
					b *= 1 - t;
					break;
				case P_EMBER:
					add = 1;
					a *= (1 - t) * (0.6 + 0.4 * Math.sin(rot * 3 + t * 40));
					g *= 1 - t * 0.5;
					break;
				case P_FLAME: {
					add = 1;
					size *= 1 - t * 0.75;
					a *= Math.min(1, t * 8) * (1 - t);
					// white core → orange → red as it rises
					g *= 1 - t * 0.7;
					b *= Math.max(0, 1 - t * 3);
					break;
				}
				case P_SMOKE:
				case P_STEAM:
				case P_PUFF:
					shape = 3;
					size *= 0.5 + t * 1.8;
					a *= Math.min(1, t * 5) * (1 - t) * (1 - t);
					break;
				case P_DROP:
					shape = 1;
					stretch = 0.02;
					aspect = 0.45;
					a *= Math.min(1, (1 - t) * 6);
					break;
				case P_MIST:
					a *= 1 - t;
					break;
				case P_FIBER:
					shape = 2;
					aspect = 0.14;
					a *= Math.min(1, (1 - t) * 3);
					break;
				case P_MOTE:
					a *= Math.sin(t * Math.PI) * (0.55 + 0.45 * Math.sin(rot * 2));
					add = 1;
					break;
				case P_CONFETTI:
				case P_PETAL:
					shape = 2;
					// tumbling: the chip turns edge-on and back
					aspect = 0.25 + 0.75 * Math.abs(Math.sin(rot * 1.7));
					a *= Math.min(1, (1 - t) * 4);
					break;
				case P_FLASH:
					add = 1;
					size *= 0.4 + t * 1.6;
					a *= (1 - t) * (1 - t);
					break;
				default:
					break;
			}
			out[q] = d[o + X];
			out[q + 1] = d[o + Y];
			out[q + 2] = d[o + Z];
			out[q + 3] = size;
			out[q + 4] = d[o + VX];
			out[q + 5] = d[o + VY];
			out[q + 6] = d[o + VZ];
			out[q + 7] = stretch;
			out[q + 8] = r;
			out[q + 9] = g;
			out[q + 10] = b;
			out[q + 11] = a;
			out[q + 12] = shape;
			out[q + 13] = rot;
			out[q + 14] = add;
			out[q + 15] = aspect;
		}
		return this.n;
	}
}
