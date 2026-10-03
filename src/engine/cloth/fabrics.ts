/**
 * Fabric library — physical behaviour and surface look for every material.
 * Physics units are normalised: cotton has particle mass 1, tension is in mass·m/s².
 */

export type FabricId =
	| "cotton"
	| "linen"
	| "silk"
	| "velvet"
	| "denim"
	| "burlap"
	| "leather"
	| "latex"
	| "paper"
	| "mail";

/** Index into the procedural weave atlas (see gfx/textures.ts). */
export const WEAVE = {
	plain: 0,
	twill: 1,
	satin: 2,
	velvet: 3,
	leather: 4,
	latex: 5,
	paper: 6,
	mail: 7,
} as const;

export type FabricLook = {
	weave: number;
	/** weave tile repeats per metre of cloth */
	tile: number;
	/** warp / weft thread colours (sRGB hex). Print multiplies on top. */
	warp: string;
	weft: string;
	rough: number;
	spec: number;
	sheen: number;
	sheenTint: string;
	/** anisotropic highlight along the threads (satin / silk) */
	aniso: number;
	/** light bleeding through from behind */
	trans: number;
	metal: number;
	/** strength of the weave normal map */
	bump: number;
	/** strength of mid-scale wrinkles */
	wrinkle: number;
	/** loose thread colour for frayed edges and flying fibres */
	thread: string;
};

export type FabricSound = {
	/** centre frequency of the rip noise band */
	freq: number;
	q: number;
	/** grain length in seconds */
	grain: number;
	kind: "rip" | "snap" | "clink" | "crackle";
};

export type Fabric = {
	id: FabricId;
	name: string;
	blurb: string;
	/** particle mass relative to cotton */
	mass: number;
	/** XPBD stretch compliance — 0 is inextensible, larger is stretchier */
	stretch: number;
	/** XPBD bending compliance — larger is floppier */
	bend: number;
	/** velocity damping per second */
	damping: number;
	/** how strongly air pushes it around */
	drag: number;
	/** tension an edge survives before it rips */
	strength: number;
	/** 0..1 how readily a tear keeps running once started */
	rip: number;
	/** strength multiplier across the bias (woven cloth rips along its threads) */
	bias: number;
	friction: number;
	/** 0 = fireproof */
	flammability: number;
	/** seconds for a lit point to burn through */
	charTime: number;
	/** fraction of strength lost when soaked */
	wetWeak: number;
	look: FabricLook;
	sound: FabricSound;
};

export const FABRICS: Record<FabricId, Fabric> = {
	cotton: {
		id: "cotton",
		name: "Cotton",
		blurb: "The classic. Tough but fair.",
		mass: 1,
		stretch: 0,
		bend: 2.5e-4,
		damping: 0.55,
		drag: 1,
		strength: 2600,
		rip: 0.5,
		bias: 1.5,
		friction: 0.6,
		flammability: 0.85,
		charTime: 1.25,
		wetWeak: 0.25,
		look: {
			weave: WEAVE.plain,
			tile: 26,
			warp: "#f3ede2",
			weft: "#e9e1d3",
			rough: 0.92,
			spec: 0.12,
			sheen: 0.35,
			sheenTint: "#fff4e6",
			aniso: 0,
			trans: 0.32,
			metal: 0,
			bump: 0.8,
			wrinkle: 0.55,
			thread: "#f1e9da",
		},
		sound: { freq: 1500, q: 0.9, grain: 0.03, kind: "rip" },
	},
	linen: {
		id: "linen",
		name: "Linen",
		blurb: "Crisp bedsheet. Rips in long runs.",
		mass: 0.85,
		stretch: 0,
		bend: 1.6e-4,
		damping: 0.6,
		drag: 1.15,
		strength: 2100,
		rip: 0.62,
		bias: 1.6,
		friction: 0.6,
		flammability: 0.9,
		charTime: 1.1,
		wetWeak: 0.2,
		look: {
			weave: WEAVE.plain,
			tile: 30,
			warp: "#f5f2ea",
			weft: "#ebe6da",
			rough: 0.95,
			spec: 0.08,
			sheen: 0.3,
			sheenTint: "#ffffff",
			aniso: 0,
			trans: 0.45,
			metal: 0,
			bump: 0.7,
			wrinkle: 0.8,
			thread: "#f4efe3",
		},
		sound: { freq: 1900, q: 0.9, grain: 0.028, kind: "rip" },
	},
	silk: {
		id: "silk",
		name: "Silk",
		blurb: "Feather light. Floats on a breath.",
		mass: 0.42,
		stretch: 0,
		bend: 2.5e-3,
		damping: 0.45,
		drag: 1.7,
		strength: 1000,
		rip: 0.78,
		bias: 1.7,
		friction: 0.35,
		flammability: 0.9,
		charTime: 0.75,
		wetWeak: 0.2,
		look: {
			weave: WEAVE.satin,
			tile: 44,
			warp: "#e86a9a",
			weft: "#d95088",
			rough: 0.34,
			spec: 0.75,
			sheen: 0.5,
			sheenTint: "#ffd9e6",
			aniso: 0.85,
			trans: 0.55,
			metal: 0,
			bump: 0.25,
			wrinkle: 0.2,
			thread: "#f4a6c4",
		},
		sound: { freq: 3200, q: 1.2, grain: 0.022, kind: "rip" },
	},
	velvet: {
		id: "velvet",
		name: "Velvet",
		blurb: "Heavy stage curtain. Drinks the light.",
		mass: 1.55,
		stretch: 0,
		bend: 1.2e-4,
		damping: 0.75,
		drag: 0.8,
		strength: 4200,
		rip: 0.4,
		bias: 1.4,
		friction: 0.8,
		flammability: 0.7,
		charTime: 1.7,
		wetWeak: 0.15,
		look: {
			weave: WEAVE.velvet,
			tile: 20,
			warp: "#7c0f1c",
			weft: "#6a0a16",
			rough: 1,
			spec: 0.02,
			sheen: 1.4,
			sheenTint: "#ff5a6a",
			aniso: 0,
			trans: 0.04,
			metal: 0,
			bump: 0.5,
			wrinkle: 0.25,
			thread: "#a21c2d",
		},
		sound: { freq: 900, q: 0.8, grain: 0.04, kind: "rip" },
	},
	denim: {
		id: "denim",
		name: "Denim",
		blurb: "Heavy twill. Needs a notch to rip.",
		mass: 1.8,
		stretch: 0,
		bend: 5e-5,
		damping: 0.8,
		drag: 0.55,
		strength: 7000,
		rip: 0.34,
		bias: 1.45,
		friction: 0.7,
		flammability: 0.45,
		charTime: 2.5,
		wetWeak: 0.3,
		look: {
			weave: WEAVE.twill,
			tile: 24,
			warp: "#2c4a7c",
			weft: "#c9d3e2",
			rough: 0.9,
			spec: 0.1,
			sheen: 0.25,
			sheenTint: "#9fb6dc",
			aniso: 0,
			trans: 0.06,
			metal: 0,
			bump: 1.1,
			wrinkle: 0.45,
			thread: "#d5dcea",
		},
		sound: { freq: 780, q: 0.8, grain: 0.045, kind: "rip" },
	},
	burlap: {
		id: "burlap",
		name: "Burlap",
		blurb: "Rough sackcloth. Burns like tinder.",
		mass: 1.25,
		stretch: 0,
		bend: 7e-5,
		damping: 0.8,
		drag: 0.75,
		strength: 3000,
		rip: 0.45,
		bias: 1.6,
		friction: 0.85,
		flammability: 1,
		charTime: 1,
		wetWeak: 0.2,
		look: {
			weave: WEAVE.plain,
			tile: 13,
			warp: "#b08a56",
			weft: "#9c7745",
			rough: 1,
			spec: 0.03,
			sheen: 0.2,
			sheenTint: "#e6c48e",
			aniso: 0,
			trans: 0.22,
			metal: 0,
			bump: 1.5,
			wrinkle: 0.5,
			thread: "#c9a570",
		},
		sound: { freq: 1100, q: 0.7, grain: 0.04, kind: "rip" },
	},
	leather: {
		id: "leather",
		name: "Leather",
		blurb: "Tough hide. Laughs at bare hands.",
		mass: 2.1,
		stretch: 0,
		bend: 2.2e-5,
		damping: 1,
		drag: 0.4,
		strength: 16000,
		rip: 0.22,
		bias: 1,
		friction: 0.9,
		flammability: 0.28,
		charTime: 3,
		wetWeak: 0.1,
		look: {
			weave: WEAVE.leather,
			tile: 9,
			warp: "#7a4a2a",
			weft: "#6a3e22",
			rough: 0.55,
			spec: 0.4,
			sheen: 0.15,
			sheenTint: "#e0a273",
			aniso: 0,
			trans: 0,
			metal: 0,
			bump: 1,
			wrinkle: 0.35,
			thread: "#8d5b37",
		},
		sound: { freq: 520, q: 0.7, grain: 0.05, kind: "rip" },
	},
	latex: {
		id: "latex",
		name: "Latex",
		blurb: "Stretches and stretches… then SNAP.",
		mass: 1.15,
		stretch: 2.6e-5,
		bend: 6e-4,
		damping: 0.35,
		drag: 0.6,
		strength: 3300,
		rip: 0.95,
		bias: 1,
		friction: 0.95,
		flammability: 0.4,
		charTime: 1.4,
		wetWeak: 0,
		look: {
			weave: WEAVE.latex,
			tile: 8,
			warp: "#e23b2e",
			weft: "#e23b2e",
			rough: 0.22,
			spec: 0.9,
			sheen: 0.1,
			sheenTint: "#ffb3a8",
			aniso: 0,
			trans: 0.3,
			metal: 0,
			bump: 0.15,
			wrinkle: 0.05,
			thread: "#ef6a5c",
		},
		sound: { freq: 900, q: 2, grain: 0.05, kind: "snap" },
	},
	paper: {
		id: "paper",
		name: "Paper",
		blurb: "Rips dead straight. Burns in seconds.",
		mass: 0.5,
		stretch: 0,
		bend: 2.5e-6,
		damping: 1.3,
		drag: 1.4,
		strength: 1100,
		rip: 1,
		bias: 1,
		friction: 0.5,
		flammability: 1,
		charTime: 0.5,
		wetWeak: 0.75,
		look: {
			weave: WEAVE.paper,
			tile: 6,
			warp: "#f4eedd",
			weft: "#efe7d2",
			rough: 0.88,
			spec: 0.1,
			sheen: 0.1,
			sheenTint: "#ffffff",
			aniso: 0,
			trans: 0.6,
			metal: 0,
			bump: 0.45,
			wrinkle: 0.15,
			thread: "#f6f1e2",
		},
		sound: { freq: 3800, q: 0.7, grain: 0.02, kind: "rip" },
	},
	mail: {
		id: "mail",
		name: "Chainmail",
		blurb: "Riveted steel rings. Bring bolt cutters.",
		mass: 3,
		stretch: 0,
		bend: 2e-3,
		damping: 0.9,
		drag: 0.12,
		strength: 40000,
		rip: 0.05,
		bias: 1,
		friction: 0.5,
		flammability: 0,
		charTime: 1,
		wetWeak: 0,
		look: {
			weave: WEAVE.mail,
			tile: 22,
			warp: "#b9c0cc",
			weft: "#8f97a5",
			rough: 0.36,
			spec: 1,
			sheen: 0,
			sheenTint: "#ffffff",
			aniso: 0,
			trans: 0,
			metal: 1,
			bump: 1.3,
			wrinkle: 0,
			thread: "#c8ced8",
		},
		sound: { freq: 3400, q: 6, grain: 0.09, kind: "clink" },
	},
};

export const FABRIC_ORDER: FabricId[] = [
	"cotton",
	"linen",
	"silk",
	"velvet",
	"denim",
	"burlap",
	"leather",
	"latex",
	"paper",
	"mail",
];

export function getFabric(id: string): Fabric {
	return FABRICS[id as FabricId] ?? FABRICS.cotton;
}
