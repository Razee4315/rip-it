export type Material = {
	id: string;
	name: string;
	desc: string;
	swatch: string;
	color: [number, number, number];
	mass: number;
	stiff: number;
	soft: number;
	damp: number;
	tear: number;
	prop: number;
	bend: number;
	wind: number;
	flam: number;
	charT: number;
	gloss: number;
	iters: number;
	sndF: number;
	sndD: number;
	spMul: number;
	render?: "mail";
};

export const MATERIALS: Material[] = [
	{
		id: "silk",
		name: "Silk",
		desc: "feather-light",
		swatch: "linear-gradient(135deg,#f6cfe0,#e2a9c2 55%,#f3c6da)",
		color: [231, 173, 196],
		mass: 0.42,
		stiff: 0.42,
		soft: 1.05,
		damp: 0.994,
		tear: 1.55,
		prop: 0.62,
		bend: 0,
		wind: 1.85,
		flam: 0.75,
		charT: 0.9,
		gloss: 0.55,
		iters: 3,
		sndF: 1800,
		sndD: 0.22,
		spMul: 1,
	},
	{
		id: "cotton",
		name: "Cotton",
		desc: "classic tee",
		swatch:
			"repeating-linear-gradient(0deg,#b23a3a 0 5px,#ece5d8 5px 10px),repeating-linear-gradient(90deg,rgba(178,58,58,.5) 0 5px,transparent 5px 10px)",
		color: [233, 225, 210],
		mass: 1,
		stiff: 0.72,
		soft: 1,
		damp: 0.985,
		tear: 2.15,
		prop: 0.5,
		bend: 0.12,
		wind: 1,
		flam: 0.85,
		charT: 1.15,
		gloss: 0,
		iters: 4,
		sndF: 1000,
		sndD: 0.3,
		spMul: 1,
	},
	{
		id: "denim",
		name: "Denim",
		desc: "heavy twill",
		swatch: "repeating-linear-gradient(45deg,#3d5f96 0 4px,#33517f 4px 8px)",
		color: [70, 104, 158],
		mass: 1.85,
		stiff: 0.88,
		soft: 0.78,
		damp: 0.978,
		tear: 3.55,
		prop: 0.32,
		bend: 0.28,
		wind: 0.38,
		flam: 0.4,
		charT: 2.6,
		gloss: 0,
		iters: 4,
		sndF: 650,
		sndD: 0.34,
		spMul: 1,
	},
	{
		id: "leather",
		name: "Leather",
		desc: "tough hide",
		swatch: "linear-gradient(135deg,#8a5c39,#6b452a 60%,#7d5233)",
		color: [133, 88, 55],
		mass: 2.0,
		stiff: 0.84,
		soft: 0.72,
		damp: 0.974,
		tear: 3.6,
		prop: 0.4,
		bend: 0.32,
		wind: 0.35,
		flam: 0.28,
		charT: 2.8,
		gloss: 0.12,
		iters: 4,
		sndF: 480,
		sndD: 0.3,
		spMul: 1,
	},
	{
		id: "rubber",
		name: "Rubber",
		desc: "stretches x4",
		swatch: "radial-gradient(circle at 35% 30%,#d0685f,#a8372f 70%)",
		color: [186, 66, 58],
		mass: 1.2,
		stiff: 0.28,
		soft: 0.85,
		damp: 0.991,
		tear: 4.1,
		prop: 0.55,
		bend: 0,
		wind: 0.55,
		flam: 0,
		charT: 1,
		gloss: 0.3,
		iters: 3,
		sndF: 900,
		sndD: 0.1,
		spMul: 1.1,
	},
	{
		id: "paper",
		name: "Paper",
		desc: "rips dead-straight",
		swatch: "linear-gradient(135deg,#f2ecdd,#e4dcc6)",
		color: [240, 233, 215],
		mass: 0.48,
		stiff: 0.9,
		soft: 1,
		damp: 0.958,
		tear: 1.08,
		prop: 1,
		bend: 0.55,
		wind: 1.35,
		flam: 1,
		charT: 0.45,
		gloss: 0,
		iters: 3,
		sndF: 2700,
		sndD: 0.24,
		spMul: 0.95,
	},
	{
		id: "mail",
		name: "Chainmail",
		desc: "metal rings",
		swatch:
			"repeating-linear-gradient(45deg,#9aa1ad 0 3px,#7d8492 3px 6px),repeating-linear-gradient(-45deg,rgba(255,255,255,.25) 0 3px,transparent 3px 6px)",
		color: [152, 158, 170],
		mass: 2.5,
		stiff: 0.95,
		soft: 0.5,
		damp: 0.972,
		tear: 4.6,
		prop: 0.08,
		bend: 0.45,
		wind: 0.22,
		flam: 0,
		charT: 1,
		gloss: 0.4,
		iters: 4,
		sndF: 2600,
		sndD: 0.12,
		spMul: 1.3,
		render: "mail",
	},
];

export function getMaterial(id: string): Material {
	return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}
