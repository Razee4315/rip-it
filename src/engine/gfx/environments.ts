/** The five places a cloth can hang. Colours are linear-light, intensities are relative. */

export type EnvId = "studio" | "backyard" | "theatre" | "forge" | "dojo";

type RGB = [number, number, number];

export type EnvDef = {
	id: EnvId;
	/** index into the backdrop shader */
	index: number;
	name: string;
	/** how far behind the cloth the back wall stands (m) */
	wallZ: number;
	/** direction toward the key light */
	lightDir: RGB;
	lightCol: RGB;
	/** when set, the key is a spotlight: offset from stage centre in stage half-sizes, and cone angle */
	spot?: { offset: RGB; angle: number };
	sky: RGB;
	ground: RGB;
	rimDir: RGB;
	rimCol: RGB;
	/** what a fully shadowed surface keeps of its lit colour */
	shadowTint: RGB;
	exposure: number;
	bloom: number;
	vignette: number;
	grain: number;
	tint: RGB;
	/** the backdrop contains a flickering light source */
	flicker: boolean;
	motes: "dust" | "pollen" | "embers" | "petals";
	/** default breeze: x, z, gustiness, turbulence */
	wind: [number, number, number, number];
};

const n = (v: RGB): RGB => {
	const l = Math.hypot(v[0], v[1], v[2]);
	return [v[0] / l, v[1] / l, v[2] / l];
};
const mul = (v: RGB, k: number): RGB => [v[0] * k, v[1] * k, v[2] * k];

export const ENVS: Record<EnvId, EnvDef> = {
	studio: {
		id: "studio",
		index: 0,
		name: "The Studio",
		wallZ: -0.75,
		lightDir: n([-0.42, 0.74, 0.62]),
		lightCol: mul([1, 0.94, 0.86], 3.1),
		sky: [0.17, 0.185, 0.23],
		ground: [0.05, 0.045, 0.045],
		rimDir: n([0.7, 0.25, -0.65]),
		rimCol: mul([0.45, 0.6, 1], 1.1),
		shadowTint: [0.3, 0.31, 0.36],
		exposure: 0.58,
		bloom: 0.5,
		vignette: 0.55,
		grain: 0.03,
		tint: [1, 1, 1],
		flicker: false,
		motes: "dust",
		wind: [0.35, -0.1, 0.5, 0.25],
	},
	backyard: {
		id: "backyard",
		index: 1,
		name: "Laundry Day",
		wallZ: -1.7,
		lightDir: n([-0.5, 0.72, 0.5]),
		lightCol: mul([1, 0.93, 0.78], 3.7),
		sky: [0.4, 0.52, 0.72],
		ground: [0.13, 0.2, 0.07],
		rimDir: n([0.6, 0.5, -0.6]),
		rimCol: mul([0.7, 0.85, 1], 0.9),
		shadowTint: [0.4, 0.46, 0.6],
		exposure: 0.5,
		bloom: 0.4,
		vignette: 0.3,
		grain: 0.022,
		tint: [1.02, 1, 0.97],
		flicker: false,
		motes: "pollen",
		wind: [1.5, -0.35, 0.65, 0.5],
	},
	theatre: {
		id: "theatre",
		index: 2,
		name: "Grand Theatre",
		wallZ: -1.2,
		lightDir: n([-0.45, 0.78, 0.5]),
		lightCol: mul([1, 0.85, 0.64], 3.6),
		spot: { offset: [-1.6, 2.6, 3.2], angle: 0.5 },
		sky: [0.035, 0.04, 0.07],
		ground: [0.035, 0.016, 0.01],
		rimDir: n([0.75, 0.3, -0.6]),
		rimCol: mul([0.3, 0.48, 1], 1.7),
		shadowTint: [0.14, 0.14, 0.2],
		exposure: 0.75,
		bloom: 0.7,
		vignette: 0.75,
		grain: 0.035,
		tint: [1.02, 0.99, 0.96],
		flicker: false,
		motes: "dust",
		wind: [0.12, -0.05, 0.4, 0.12],
	},
	forge: {
		id: "forge",
		index: 3,
		name: "The Forge",
		wallZ: -0.8,
		lightDir: n([0.5, 0.7, 0.55]),
		lightCol: mul([1, 0.8, 0.58], 2.5),
		sky: [0.075, 0.07, 0.085],
		ground: [0.13, 0.05, 0.018],
		rimDir: n([-0.85, -0.1, 0.2]),
		rimCol: mul([1, 0.36, 0.08], 2.2),
		shadowTint: [0.26, 0.22, 0.22],
		exposure: 0.8,
		bloom: 0.8,
		vignette: 0.65,
		grain: 0.035,
		tint: [1.03, 0.99, 0.95],
		flicker: true,
		motes: "embers",
		wind: [0.25, -0.1, 0.5, 0.3],
	},
	dojo: {
		id: "dojo",
		index: 4,
		name: "Paper Dojo",
		wallZ: -1.0,
		lightDir: n([0.4, 0.72, 0.6]),
		lightCol: mul([1, 0.86, 0.66], 2.5),
		sky: [0.25, 0.2, 0.135],
		ground: [0.1, 0.085, 0.045],
		rimDir: n([-0.2, 0.15, -0.95]),
		rimCol: mul([1, 0.82, 0.55], 1.5),
		shadowTint: [0.42, 0.38, 0.36],
		exposure: 0.7,
		bloom: 0.55,
		vignette: 0.5,
		grain: 0.028,
		tint: [1.01, 1, 0.97],
		flicker: false,
		motes: "petals",
		wind: [0.5, -0.15, 0.55, 0.3],
	},
};
