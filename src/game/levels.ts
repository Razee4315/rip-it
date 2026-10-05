/**
 * The campaign: four worlds, six levels each. Every level is a cloth, a place, a few tools
 * and one thing to do with them.
 */
import type { EnvId } from "@/engine/gfx/environments";
import type { Shape } from "@/engine/gfx/prints";
import type { ToolId } from "@/engine/tools";
import type { LevelDef, StarRule } from "./types";

export type WorldDef = {
	n: number;
	env: EnvId;
	name: string;
	tagline: string;
	/** accent colours for the level-select card */
	hue: [string, string];
};

export const WORLDS: WorldDef[] = [
	{
		n: 1,
		env: "backyard",
		name: "Laundry Day",
		tagline: "Sunshine, a breeze, and someone else's washing.",
		hue: ["#3d9be9", "#7ed957"],
	},
	{
		n: 2,
		env: "theatre",
		name: "Grand Theatre",
		tagline: "Velvet, spotlights and a very sharp blade.",
		hue: ["#b3122a", "#f2b84b"],
	},
	{
		n: 3,
		env: "forge",
		name: "The Forge",
		tagline: "Things that burn. Things that go bang.",
		hue: ["#ff5a1f", "#ffc24b"],
	},
	{
		n: 4,
		env: "dojo",
		name: "Paper Dojo",
		tagline: "Steady hands. Clean cuts. Quiet mending.",
		hue: ["#d9a15c", "#f4d9a8"],
	},
];

// ── star conditions ─────────────────────────────────────────────
const under = (sec: number): StarRule => ({
	label: `Finish in ${sec}s`,
	test: (r) => r.time <= sec,
});
const cuts = (n: number): StarRule => ({
	label: n === 1 ? "Just one cut" : `${n} cuts or fewer`,
	test: (r) => r.strokes <= n,
});
const accuracy = (pct: number): StarRule => ({
	label: `${pct}% accurate`,
	test: (r) => r.quality * 100 >= pct,
});
const keep = (pct: number): StarRule => ({
	label: `Keep ${pct}% intact`,
	test: (r) => r.quality * 100 >= pct,
});
const sparing = (tool: ToolId, max: number, label: string): StarRule => ({
	label,
	test: (r) => (r.used[tool] ?? 0) <= max,
});

// ── shapes printed on cloth ─────────────────────────────────────
const HEART: Shape = { kind: "heart", cx: 0.5, cy: 0.5, r: 0.2 };
const STAR: Shape = { kind: "star", cx: 0.5, cy: 0.52, r: 0.23 };
const RING: Shape = { kind: "circle", cx: 0.5, cy: 0.5, r: 0.19 };
const CREST: Shape = { kind: "shield", cx: 0.5, cy: 0.36, r: 0.17 };
const CREST_MID: Shape = { kind: "shield", cx: 0.5, cy: 0.46, r: 0.18 };
const GEM: Shape = { kind: "diamond", cx: 0.5, cy: 0.4, r: 0.2 };

export const LEVELS: LevelDef[] = [
	// ════════════ World 1 · Laundry Day ════════════
	{
		id: "1-1",
		world: 1,
		n: 1,
		name: "First Rip",
		brief: "Tear the towel in two",
		tip: "Grab the cloth and pull hard. On a phone, use two fingers and pull them apart.",
		env: "backyard",
		cloth: {
			fabric: "cotton",
			w: 1.3,
			h: 0.9,
			tall: { w: 0.95, h: 1.25 },
			mount: { kind: "line", pegs: 3 },
			print: { pattern: { kind: "gingham", color: "#c4262b" }, hem: "#ffffff" },
		},
		tools: ["hand"],
		objective: { type: "pieces", count: 2 },
		stars: [under(12), under(6)],
	},
	{
		id: "1-2",
		world: 1,
		n: 2,
		name: "Clean Sheets",
		brief: "Rip most of the sheet off the line",
		tip: "Rips run. Start one and keep pulling.",
		env: "backyard",
		cloth: {
			fabric: "linen",
			w: 1.75,
			h: 1.0,
			tall: { w: 1.0, h: 1.5 },
			mount: { kind: "line", pegs: 5 },
			print: {
				pattern: { kind: "stripes", color: "#bcd3ee", cell: 0.11 },
				hem: "#7fa3d1",
			},
		},
		tools: ["hand"],
		objective: { type: "clear", pct: 0.6 },
		stars: [under(25), under(14)],
	},
	{
		id: "1-3",
		world: 1,
		n: 3,
		name: "Snip Snip",
		brief: "Cut the cloth down",
		tip: "Drag the scissors across the cloth for a long clean cut.",
		env: "backyard",
		cloth: {
			fabric: "cotton",
			w: 1.5,
			h: 0.95,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "line", pegs: 4 },
			print: { base: "#fff3cf", pattern: { kind: "dots", color: "#e8862a" }, hem: "#e8862a" },
		},
		tools: ["scissors"],
		limits: { scissors: 5 },
		objective: { type: "clear", pct: 0.9 },
		stars: [cuts(2), cuts(1)],
	},
	{
		id: "1-4",
		world: 1,
		n: 4,
		name: "Cut It Out",
		brief: "Cut the heart free",
		tip: "Follow the dashed line. The closer you keep to it, the more stars.",
		env: "backyard",
		cloth: {
			fabric: "cotton",
			w: 1.35,
			h: 1.0,
			tall: { w: 1.0, h: 1.2 },
			mount: { kind: "line", pegs: 4 },
			print: {
				base: "#f7f1e3",
				emblem: { shape: HEART, fill: "#d8263c", detail: "#ffd0d6", guide: true },
				hem: "#d8263c",
			},
			target: HEART,
		},
		tools: ["scissors"],
		objective: { type: "cutout" },
		stars: [accuracy(74), accuracy(86)],
	},
	{
		id: "1-5",
		world: 1,
		n: 5,
		name: "Windy Day",
		brief: "Shred the scarf into five",
		tip: "Silk is delicate. Catch it as it flies.",
		env: "backyard",
		cloth: {
			fabric: "silk",
			w: 1.5,
			h: 0.8,
			tall: { w: 0.95, h: 1.2 },
			mount: { kind: "line", pegs: 3 },
			print: { hem: "#ffd9e8" },
		},
		tools: ["hand"],
		objective: { type: "pieces", count: 5 },
		stars: [under(20), under(10)],
	},
	{
		id: "1-6",
		world: 1,
		n: 6,
		name: "Tough Jeans",
		brief: "Rip the denim into three",
		tip: "Too tough for bare hands — until you snip a notch in the edge.",
		env: "backyard",
		cloth: {
			fabric: "denim",
			w: 1.3,
			h: 0.95,
			tall: { w: 0.95, h: 1.25 },
			mount: { kind: "line", pegs: 4 },
			print: { pattern: { kind: "wash" }, hem: "#d9902f" },
		},
		tools: ["scissors", "hand"],
		limits: { scissors: 2 },
		objective: { type: "pieces", count: 3 },
		stars: [under(25), under(14)],
	},

	// ════════════ World 2 · Grand Theatre ════════════
	{
		id: "2-1",
		world: 2,
		n: 1,
		name: "Curtain Up",
		brief: "Reveal the painting",
		tip: "Whatever hides the picture has to come down.",
		env: "theatre",
		cloth: {
			fabric: "velvet",
			w: 1.6,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "rod", clips: 9, gather: 0.84 },
			print: { trim: "#c99a2e" },
		},
		tools: ["scissors"],
		limits: { scissors: 5 },
		art: "sunset",
		objective: { type: "reveal", pct: 0.75 },
		stars: [cuts(2), under(8)],
	},
	{
		id: "2-2",
		world: 2,
		n: 2,
		name: "Slash",
		brief: "Slice the banner into six",
		tip: "The blade only bites when you slash fast.",
		env: "theatre",
		cloth: {
			fabric: "silk",
			w: 1.6,
			h: 0.95,
			tall: { w: 1.0, h: 1.35 },
			mount: { kind: "batten" },
			dye: "#f2c14e",
			print: { pattern: { kind: "bands", colors: ["#ffffff", "#c9892b", "#ffffff"] } },
		},
		tools: ["blade"],
		objective: { type: "pieces", count: 6 },
		stars: [under(12), sparing("blade", 5, "5 slashes or fewer")],
	},
	{
		id: "2-3",
		world: 2,
		n: 3,
		name: "Star of the Show",
		brief: "Cut the star free",
		tip: "Corners are where it goes wrong. Slow down for them.",
		env: "theatre",
		cloth: {
			fabric: "velvet",
			w: 1.35,
			h: 1.0,
			tall: { w: 1.0, h: 1.2 },
			mount: { kind: "batten" },
			print: {
				emblem: { shape: STAR, fill: "#ffcf4a", detail: "#fff3c4", guide: true },
				trim: "#c99a2e",
			},
			target: STAR,
		},
		tools: ["scissors"],
		objective: { type: "cutout" },
		stars: [accuracy(72), accuracy(84)],
	},
	{
		id: "2-4",
		world: 2,
		n: 4,
		name: "The Unveiling",
		brief: "Tear the veil away",
		tip: "No tools this time. Just your hands.",
		env: "theatre",
		cloth: {
			fabric: "silk",
			w: 1.6,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "rod", clips: 8, gather: 0.88 },
			dye: "#f1ede4",
			print: {},
		},
		tools: ["hand"],
		art: "night",
		objective: { type: "reveal", pct: 0.8 },
		stars: [under(16), under(9)],
	},
	{
		id: "2-5",
		world: 2,
		n: 5,
		name: "Encore",
		brief: "Bring the curtain down — fast",
		tip: "Twenty seconds. Slash across the top.",
		env: "theatre",
		cloth: {
			fabric: "velvet",
			w: 1.75,
			h: 1.0,
			tall: { w: 1.0, h: 1.45 },
			mount: { kind: "rod", clips: 10, gather: 0.82 },
			print: { trim: "#c99a2e" },
		},
		tools: ["blade"],
		timeLimit: 20,
		objective: { type: "clear", pct: 0.9 },
		stars: [under(10), sparing("blade", 4, "4 slashes or fewer")],
	},
	{
		id: "2-6",
		world: 2,
		n: 6,
		name: "Standing Ovation",
		brief: "Trim away all but the crest",
		tip: "Cut the plain cloth off and let it fall. The crest must stay hanging, unharmed.",
		env: "theatre",
		cloth: {
			fabric: "cotton",
			w: 1.5,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "batten" },
			print: {
				base: "#1f3a8a",
				emblem: { shape: CREST, fill: "#f3c23c", detail: "#7a1a1a" },
				hem: "#f3c23c",
			},
			target: CREST,
		},
		tools: ["scissors"],
		objective: { type: "protect", clear: 0.62, keep: 0.9 },
		stars: [keep(97), cuts(5)],
	},

	// ════════════ World 3 · The Forge ════════════
	{
		id: "3-1",
		world: 3,
		n: 1,
		name: "Kindling",
		brief: "Burn the sackcloth",
		tip: "Fire climbs. Light it low and let it rise.",
		env: "forge",
		cloth: {
			fabric: "burlap",
			w: 1.4,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "batten" },
			print: {
				text: {
					str: "GRAIN",
					color: "#2a2014",
					size: 0.2,
					cy: 0.42,
					stencil: true,
					sub: "50 KG · KEEP DRY",
				},
				age: 1,
			},
		},
		tools: ["torch"],
		limits: { torch: 5 },
		objective: { type: "burn", pct: 0.8 },
		stars: [under(22), sparing("torch", 1.2, "Barely touch the torch")],
	},
	{
		id: "3-2",
		world: 3,
		n: 2,
		name: "Wet Blanket",
		brief: "Burn it — the soaked band won't catch",
		tip: "Water stops fire dead. You'll have to light it more than once.",
		env: "forge",
		cloth: {
			fabric: "cotton",
			w: 1.45,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "rod", clips: 8, gather: 0.9 },
			print: { pattern: { kind: "tartan", color: "#7a1f1f", color2: "#1f4d2e" }, hem: "#f0e6c8" },
		},
		tools: ["torch"],
		limits: { torch: 6 },
		pre: [
			{ op: "wet", u: 0.1, v: 0.5, r: 0.16 },
			{ op: "wet", u: 0.3, v: 0.5, r: 0.16 },
			{ op: "wet", u: 0.5, v: 0.5, r: 0.16 },
			{ op: "wet", u: 0.7, v: 0.5, r: 0.16 },
			{ op: "wet", u: 0.9, v: 0.5, r: 0.16 },
		],
		objective: { type: "burn", pct: 0.6 },
		stars: [under(28), sparing("torch", 2.5, "Use the torch sparingly")],
	},
	{
		id: "3-3",
		world: 3,
		n: 3,
		name: "Save the Crest",
		brief: "Burn the banner, spare the crest",
		tip: "Wet cloth will not burn. Soak what you want to keep.",
		env: "forge",
		cloth: {
			fabric: "cotton",
			w: 1.4,
			h: 1.05,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "batten" },
			print: {
				base: "#8f1d1d",
				emblem: { shape: CREST_MID, fill: "#f0e6c8", detail: "#8f1d1d" },
				hem: "#f3c23c",
			},
			target: CREST_MID,
		},
		tools: ["water", "torch"],
		limits: { torch: 5, water: 7 },
		objective: { type: "protect", clear: 0.45, keep: 0.82 },
		stars: [keep(93), under(35)],
	},
	{
		id: "3-4",
		world: 3,
		n: 4,
		name: "Short Fuse",
		brief: "Blast the hide off its hooks",
		tip: "Tap to stick a firecracker to the cloth. Leather shrugs off everything else.",
		env: "forge",
		cloth: {
			fabric: "leather",
			w: 1.3,
			h: 0.95,
			tall: { w: 0.95, h: 1.2 },
			mount: { kind: "corners", gather: 0.94 },
			print: { hem: "#3a2414", age: 0.8 },
		},
		tools: ["cracker"],
		limits: { cracker: 4 },
		objective: { type: "clear", pct: 0.9 },
		stars: [
			sparing("cracker", 3, "3 firecrackers or fewer"),
			sparing("cracker", 2, "Only 2 firecrackers"),
		],
	},
	{
		id: "3-5",
		world: 3,
		n: 5,
		name: "Ring Mail",
		brief: "Cut a disc from the chainmail",
		tip: "Bolt cutters go through steel. Mind the sparks.",
		env: "forge",
		cloth: {
			fabric: "mail",
			w: 1.3,
			h: 1.0,
			tall: { w: 0.95, h: 1.2 },
			mount: { kind: "batten" },
			print: { emblem: { shape: RING, fill: "#e8b84a", guide: true } },
			target: RING,
		},
		tools: ["scissors"],
		objective: { type: "cutout" },
		stars: [accuracy(74), accuracy(86)],
	},
	{
		id: "3-6",
		world: 3,
		n: 6,
		name: "Inferno",
		brief: "Burn it all before time runs out",
		tip: "A firecracker starts a fire in a hurry.",
		env: "forge",
		cloth: {
			fabric: "burlap",
			w: 1.75,
			h: 1.0,
			tall: { w: 1.0, h: 1.45 },
			mount: { kind: "rod", clips: 10, gather: 0.86 },
			print: { age: 1 },
		},
		tools: ["torch", "cracker"],
		limits: { torch: 3, cracker: 2 },
		timeLimit: 28,
		objective: { type: "burn", pct: 0.85 },
		stars: [under(18), sparing("cracker", 0, "No firecrackers")],
	},

	// ════════════ World 4 · Paper Dojo ════════════
	{
		id: "4-1",
		world: 4,
		n: 1,
		name: "Shoji",
		brief: "Punch out half the paper screen",
		tip: "Paper rips dead straight. Grab the middle and pull.",
		env: "dojo",
		cloth: {
			fabric: "paper",
			w: 1.3,
			h: 0.95,
			tall: { w: 0.95, h: 1.2 },
			mount: { kind: "frame" },
			print: { base: "#fbf6e6" },
			gap: 0.3,
		},
		tools: ["hand"],
		objective: { type: "clear", pct: 0.45 },
		stars: [under(20), under(10)],
	},
	{
		id: "4-2",
		world: 4,
		n: 2,
		name: "Thousand Cuts",
		brief: "Slice the silk into ten",
		tip: "Fifteen seconds. Don't stop moving.",
		env: "dojo",
		cloth: {
			fabric: "silk",
			w: 1.6,
			h: 1.0,
			tall: { w: 1.0, h: 1.4 },
			mount: { kind: "batten" },
			dye: "#f6f2ea",
			print: { emblem: { shape: { kind: "circle", cx: 0.5, cy: 0.5, r: 0.17 }, fill: "#c81e1e" } },
		},
		tools: ["blade"],
		timeLimit: 15,
		objective: { type: "pieces", count: 10 },
		stars: [under(10), under(7)],
	},
	{
		id: "4-3",
		world: 4,
		n: 3,
		name: "Mending",
		brief: "Stitch the torn silk closed",
		tip: "Drag the needle along a tear. The edges pull together and knit.",
		env: "dojo",
		cloth: {
			fabric: "silk",
			w: 1.4,
			h: 0.95,
			tall: { w: 1.0, h: 1.25 },
			mount: { kind: "batten" },
			dye: "#9ed3bb",
			print: { pattern: { kind: "dots", color: "#f3fbf7", cell: 0.16 } },
		},
		tools: ["needle"],
		pre: [
			{
				op: "cut",
				pts: [
					[0.18, 0.42],
					[0.5, 0.5],
					[0.8, 0.4],
				],
			},
		],
		objective: { type: "mend" },
		stars: [under(30), under(16)],
	},
	{
		id: "4-4",
		world: 4,
		n: 4,
		name: "Ensō",
		brief: "Cut the circle from the paper",
		tip: "Paper forgives nothing: a careless tug and it tears.",
		env: "dojo",
		cloth: {
			fabric: "paper",
			w: 1.3,
			h: 1.0,
			tall: { w: 0.95, h: 1.2 },
			mount: { kind: "batten" },
			print: {
				base: "#fbf6e6",
				emblem: { shape: RING, fill: "#17151a", detail: "#fbf6e6", guide: true },
			},
			target: RING,
		},
		tools: ["scissors"],
		objective: { type: "cutout" },
		stars: [accuracy(78), accuracy(88)],
	},
	{
		id: "4-5",
		world: 4,
		n: 5,
		name: "Kintsugi",
		brief: "Mend three tears in the wind",
		tip: "Pin a flapping edge down first, then stitch.",
		env: "dojo",
		cloth: {
			fabric: "linen",
			w: 1.5,
			h: 1.0,
			tall: { w: 1.0, h: 1.3 },
			mount: { kind: "batten" },
			print: {
				base: "#f3ead6",
				pattern: { kind: "stripes", color: "#c9a25a", cell: 0.2, horizontal: true },
				hem: "#c9a25a",
			},
		},
		tools: ["needle", "pin"],
		pre: [
			{
				op: "cut",
				pts: [
					[0.12, 0.3],
					[0.45, 0.38],
				],
			},
			{
				op: "cut",
				pts: [
					[0.55, 0.62],
					[0.9, 0.52],
				],
			},
			{
				op: "cut",
				pts: [
					[0.5, 0.2],
					[0.62, 0.48],
				],
			},
		],
		objective: { type: "mend" },
		stars: [under(40), under(24)],
	},
	{
		id: "4-6",
		world: 4,
		n: 6,
		name: "The Master",
		brief: "Destroy the scroll, save the seal",
		tip: "Every tool you've learned. Paper burns in seconds — soak the seal first.",
		env: "dojo",
		cloth: {
			fabric: "paper",
			w: 1.4,
			h: 1.05,
			tall: { w: 1.0, h: 1.35 },
			mount: { kind: "batten" },
			print: {
				base: "#fbf6e6",
				pattern: { kind: "ruled", color: "#b9c4d6" },
				emblem: { shape: GEM, fill: "#c81e1e", detail: "#fbf6e6" },
			},
			target: GEM,
		},
		tools: ["scissors", "water", "torch"],
		limits: { torch: 3, water: 6 },
		objective: { type: "protect", clear: 0.6, keep: 0.88 },
		stars: [keep(96), under(30)],
	},
];

export function levelById(id: string): LevelDef | undefined {
	return LEVELS.find((l) => l.id === id);
}

export function levelsOfWorld(n: number): LevelDef[] {
	return LEVELS.filter((l) => l.world === n);
}

export function nextLevel(id: string): LevelDef | undefined {
	const i = LEVELS.findIndex((l) => l.id === id);
	return i >= 0 ? LEVELS[i + 1] : undefined;
}
