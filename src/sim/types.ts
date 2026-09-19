export type Fray = { a: number; l: number; dark: boolean };

export type Particle = {
	x: number;
	y: number;
	px: number;
	py: number;
	pin: boolean;
	rodPin: boolean;
	wet: number;
	burn: boolean;
	burnT: number;
	char: number;
	fray: Fray[] | null;
	sh: number;
};

export type Constraint = {
	a: number;
	b: number;
	rest: number;
	type: number;
	k: number;
	dmg: number;
	broken: boolean;
	span: Constraint[] | null;
};

export type Tri = {
	a: number;
	b: number;
	c: number;
	k1: Constraint;
	k2: Constraint;
	k3: Constraint;
	i: number;
	j: number;
};

export type GameStats = {
	destroyed: number;
	pieces: number;
	fibers: number;
	fps: number;
	burning: number;
};

/** First-time player actions the tip ladder hooks into. */
export type Milestone = "tear" | "cut" | "burn";

/** Recap payload fired when the cloth is fully shredded. */
export type PartyPayload = {
	fibers: number;
	pieces: number;
	pct: number;
	seconds: number;
};
