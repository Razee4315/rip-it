/** The physical things a cloth hangs from: rods, rings, pegs, ropes, frames. */
import type { Layout, Mount } from "../cloth/layout";
import { compose, mat4 } from "../math";
import type { Prop } from "./Renderer";

type RGB = [number, number, number];
const WOOD: RGB = [0.3, 0.16, 0.07];
const WOOD_PALE: RGB = [0.62, 0.45, 0.26];
const BRASS: RGB = [0.83, 0.6, 0.24];
const STEEL: RGB = [0.62, 0.64, 0.68];
const ROPE: RGB = [0.5, 0.4, 0.25];
const IRON: RGB = [0.12, 0.12, 0.13];
const HALF_PI = Math.PI / 2;

export type MountInfo = {
	cx: number;
	topY: number;
	z: number;
	w: number;
	h: number;
	wallZ: number;
	/** metal finish reads better in dark rooms, wood outdoors */
	metal: boolean;
};

function prop(
	mesh: Prop["mesh"],
	x: number,
	y: number,
	z: number,
	sx: number,
	sy: number,
	sz: number,
	color: RGB,
	rough: number,
	metal: number,
	kind = 0,
	rotZ = 0,
	rotY = 0,
	rotX = 0,
): Prop {
	return {
		mesh,
		model: compose(mat4(), x, y, z, sx, sy, sz, rotZ, rotY, rotX),
		scale: [sx, sy, sz],
		color,
		rough,
		metal,
		kind,
	};
}

export function mountProps(mount: Mount, lay: Layout, m: MountInfo): Prop[] {
	const out: Prop[] = [];
	const P = lay.positions;
	const hw = lay.hardware;
	const left = m.cx - m.w / 2,
		right = m.cx + m.w / 2;

	if (mount.kind === "rod") {
		const rodY = m.topY + 0.075;
		const span = m.w * mount.gather;
		const len = span + 0.34;
		const finish: RGB = m.metal ? BRASS : WOOD;
		const mt = m.metal ? 1 : 0;
		out.push(
			prop(
				"cyl",
				m.cx,
				rodY,
				m.z,
				0.016,
				len,
				0.016,
				finish,
				m.metal ? 0.32 : 0.55,
				mt,
				m.metal ? 0 : 1,
				HALF_PI,
			),
		);
		for (const s of [-1, 1]) {
			const x = m.cx + (s * len) / 2;
			out.push(prop("sphere", x, rodY, m.z, 0.032, 0.032, 0.032, finish, 0.3, mt, m.metal ? 0 : 1));
			// bracket back to the wall
			const bx = m.cx + s * (len / 2 - 0.06);
			const depth = Math.min(0.5, m.z - m.wallZ);
			out.push(prop("box", bx, rodY, m.z - depth / 2, 0.014, 0.014, depth, IRON, 0.5, 1));
		}
		for (const p of hw) {
			const x = P[p * 3],
				z = P[p * 3 + 2];
			out.push(
				prop("torus", x, rodY - 0.013, m.z, 0.029, 0.029, 0.029, BRASS, 0.3, 1, 0, 0, HALF_PI),
			);
			const clipH = rodY - 0.042 - m.topY + 0.014;
			out.push(prop("box", x, m.topY - 0.007 + clipH / 2, z, 0.012, clipH, 0.008, STEEL, 0.4, 1));
		}
	} else if (mount.kind === "line") {
		const y = m.topY + 0.004;
		const len = m.w + 1.3;
		out.push(prop("cyl", m.cx, y, m.z - 0.006, 0.0045, len, 0.0045, ROPE, 0.9, 0, 2, HALF_PI));
		for (const s of [-1, 1]) {
			const x = m.cx + s * (m.w / 2 + 0.42);
			const ph = m.topY + 0.3;
			out.push(prop("cyl", x, ph / 2, m.z - 0.006, 0.038, ph, 0.038, WOOD, 0.75, 0, 1));
			out.push(prop("box", x, m.topY + 0.02, m.z - 0.006, 0.5, 0.05, 0.05, WOOD, 0.75, 0, 1));
		}
		for (const p of hw) {
			const x = P[p * 3],
				y0 = P[p * 3 + 1],
				z = P[p * 3 + 2];
			// a wooden clothes peg: two prongs and a wire spring
			for (const s of [-1, 1])
				out.push(
					prop(
						"box",
						x,
						y0 - 0.012,
						z + s * 0.006,
						0.013,
						0.074,
						0.007,
						WOOD_PALE,
						0.7,
						0,
						1,
						0,
						0,
						s * 0.09,
					),
				);
			out.push(prop("cyl", x, y0 + 0.004, z, 0.011, 0.016, 0.011, STEEL, 0.35, 1, 0, HALF_PI));
		}
	} else if (mount.kind === "corners" || mount.kind === "batten") {
		if (mount.kind === "batten")
			out.push(prop("box", m.cx, m.topY + 0.006, m.z, m.w + 0.07, 0.038, 0.024, WOOD, 0.6, 0, 1));
		const xs =
			mount.kind === "batten"
				? [m.cx - m.w * 0.36, m.cx + m.w * 0.36]
				: [P[hw[0] * 3], P[hw[hw.length - 1] * 3]];
		for (const x of xs) {
			out.push(prop("cyl", x, m.topY + 1.6, m.z, 0.004, 3.2, 0.004, ROPE, 0.9, 0, 2));
			if (mount.kind === "corners")
				out.push(prop("torus", x, m.topY, m.z + 0.002, 0.014, 0.014, 0.014, BRASS, 0.3, 1));
		}
	} else if (mount.kind === "pole") {
		const x = left - 0.026;
		const ph = m.topY + 0.22;
		out.push(
			prop(
				"cyl",
				x,
				ph / 2,
				m.z,
				0.021,
				ph,
				0.021,
				m.metal ? STEEL : WOOD,
				0.4,
				m.metal ? 1 : 0,
				m.metal ? 0 : 1,
			),
		);
		out.push(prop("sphere", x, ph + 0.03, m.z, 0.042, 0.042, 0.042, BRASS, 0.25, 1));
		out.push(prop("cyl", x, 0.02, m.z, 0.14, 0.04, 0.14, IRON, 0.6, 1));
		for (const p of hw)
			out.push(
				prop(
					"torus",
					x + 0.012,
					P[p * 3 + 1],
					m.z,
					0.02,
					0.02,
					0.02,
					BRASS,
					0.3,
					1,
					0,
					0,
					0,
					HALF_PI,
				),
			);
	} else if (mount.kind === "frame") {
		const t = 0.05;
		const cy = m.topY - m.h / 2;
		const fr: RGB = m.metal ? IRON : WOOD;
		const mt = m.metal ? 1 : 0;
		const kd = m.metal ? 0 : 1;
		out.push(prop("box", m.cx, m.topY + t / 2, m.z, m.w + t * 2, t, t, fr, 0.5, mt, kd));
		out.push(prop("box", m.cx, m.topY - m.h - t / 2, m.z, m.w + t * 2, t, t, fr, 0.5, mt, kd));
		for (const s of [-1, 1]) {
			const x = m.cx + s * (m.w / 2 + t / 2);
			out.push(prop("box", x, cy, m.z, t, m.h, t, fr, 0.5, mt, kd));
			// legs and feet
			const legH = m.topY - m.h - t;
			if (legH > 0.02) {
				out.push(prop("box", x, legH / 2, m.z, t, legH, t, fr, 0.5, mt, kd));
				out.push(prop("box", x, 0.015, m.z, t * 1.4, 0.03, 0.36, fr, 0.5, mt, kd));
			}
		}
	}
	void right;
	return out;
}

/** Drawing pins the player has pushed in. */
export function pinProps(points: number[]): Prop[] {
	const out: Prop[] = [];
	for (let i = 0; i < points.length; i += 3) {
		const x = points[i],
			y = points[i + 1],
			z = points[i + 2];
		out.push(
			prop(
				"sphere",
				x + 0.004,
				y + 0.006,
				z + 0.022,
				0.011,
				0.011,
				0.011,
				[0.75, 0.04, 0.03],
				0.25,
				0,
			),
		);
		out.push(
			prop(
				"cyl",
				x + 0.002,
				y + 0.003,
				z + 0.011,
				0.0018,
				0.024,
				0.0018,
				STEEL,
				0.3,
				1,
				0,
				0,
				0,
				HALF_PI,
			),
		);
	}
	return out;
}

/** An easel-mounted, gilt-framed picture standing just behind the cloth. */
export function artProps(cx: number, cy: number, z: number, w: number, h: number): Prop[] {
	const out: Prop[] = [];
	const t = 0.045;
	const gold: RGB = [0.78, 0.55, 0.18];
	out.push(prop("box", cx, cy + h / 2 + t / 2, z, w + t * 2, t, 0.04, gold, 0.35, 1));
	out.push(prop("box", cx, cy - h / 2 - t / 2, z, w + t * 2, t, 0.04, gold, 0.35, 1));
	for (const s of [-1, 1]) {
		out.push(prop("box", cx + s * (w / 2 + t / 2), cy, z, t, h, 0.04, gold, 0.35, 1));
		// easel legs
		const lx = cx + s * (w / 2 - 0.05);
		const legH = cy - h / 2;
		if (legH > 0.05)
			out.push(prop("box", lx, legH / 2, z - 0.03, 0.035, legH, 0.035, WOOD, 0.6, 0, 1));
	}
	return out;
}
