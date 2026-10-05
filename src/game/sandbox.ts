/** Free play and the title screen are just levels without a goal. */
import type { FabricId } from "@/engine/cloth/fabrics";
import type { Mount } from "@/engine/cloth/layout";
import type { EnvId } from "@/engine/gfx/environments";
import type { PrintSpec } from "@/engine/gfx/prints";
import { ALL_TOOLS } from "@/engine/tools";
import type { LevelDef, StarRule } from "./types";

const NONE: StarRule = { label: "", test: () => true };

export type MountId = "rod" | "line" | "corners" | "pole" | "frame" | "batten";

export const MOUNTS: { id: MountId; name: string; mount: Mount }[] = [
	{ id: "rod", name: "Curtain rod", mount: { kind: "rod", clips: 9, gather: 0.86 } },
	{ id: "line", name: "Washing line", mount: { kind: "line", pegs: 4 } },
	{ id: "corners", name: "Two corners", mount: { kind: "corners", gather: 0.93 } },
	{ id: "pole", name: "Flagpole", mount: { kind: "pole" } },
	{ id: "frame", name: "Frame", mount: { kind: "frame" } },
	{ id: "batten", name: "Batten", mount: { kind: "batten" } },
];

export const PLACES: { id: EnvId; name: string }[] = [
	{ id: "studio", name: "Studio" },
	{ id: "backyard", name: "Backyard" },
	{ id: "theatre", name: "Theatre" },
	{ id: "forge", name: "Forge" },
	{ id: "dojo", name: "Dojo" },
];

/** "" = the fabric's own colour */
export const DYES = [
	"",
	"#f3efe6",
	"#d8263c",
	"#f2a81d",
	"#2f8f5b",
	"#2a62c9",
	"#7b3fc4",
	"#1b1a1f",
];

/** How each fabric comes dressed when it is not part of a level. */
const DEFAULT_PRINT: Record<FabricId, PrintSpec> = {
	cotton: { pattern: { kind: "gingham", color: "#c4262b" }, hem: "#ffffff" },
	linen: { pattern: { kind: "stripes", color: "#bcd3ee", cell: 0.11 }, hem: "#7fa3d1" },
	silk: { hem: "#ffd9e8" },
	velvet: { trim: "#c99a2e" },
	denim: { pattern: { kind: "wash" }, hem: "#d9902f" },
	burlap: {
		text: {
			str: "COFFEE",
			color: "#2a2014",
			size: 0.19,
			cy: 0.42,
			stencil: true,
			sub: "60 KG · PRODUCE OF BRAZIL",
		},
		age: 1,
	},
	leather: { hem: "#3a2414", age: 0.8 },
	latex: {},
	paper: { pattern: { kind: "ruled", color: "#b9c4d6" } },
	mail: {},
};

export type SandboxOpts = {
	fabric: FabricId;
	env: EnvId;
	mount: MountId;
	dye: string;
};

export const DEFAULT_SANDBOX: SandboxOpts = {
	fabric: "cotton",
	env: "studio",
	mount: "rod",
	dye: "",
};

export function sandboxLevel(o: SandboxOpts): LevelDef {
	const mount = (MOUNTS.find((m) => m.id === o.mount) ?? MOUNTS[0]).mount;
	// a dyed cloth is a plain one: the stock print would fight the colour
	const print: PrintSpec = o.dye ? { hem: "#ffffff" } : DEFAULT_PRINT[o.fabric];
	const flag = o.mount === "pole";
	return {
		id: "sandbox",
		world: 0,
		n: 0,
		name: "Sandbox",
		brief: "No rules. Wreck it.",
		env: o.env,
		cloth: {
			fabric: o.fabric,
			w: flag ? 1.45 : 1.65,
			h: flag ? 0.9 : 1.0,
			tall: { w: 1.0, h: flag ? 0.8 : 1.4 },
			mount,
			print,
			dye: o.dye || undefined,
			gap: flag ? 0.55 : o.mount === "frame" ? 0.3 : undefined,
		},
		tools: ALL_TOOLS,
		objective: { type: "sandbox" },
		stars: [NONE, NONE],
	};
}

/** The banner on the title screen. It tears, of course. */
export function titleLevel(): LevelDef {
	return {
		id: "title",
		world: 0,
		n: 0,
		name: "RIP IT!",
		brief: "",
		env: "studio",
		cloth: {
			fabric: "linen",
			w: 1.5,
			h: 0.8,
			tall: { w: 1.0, h: 0.72 },
			mount: { kind: "batten" },
			dye: "#f3ead8",
			print: {
				text: { str: "RIP IT!", color: "#141217", size: 0.27, cy: 0.44, sub: "TEAR · CUT · BURN" },
				hem: "#e0452c",
			},
			gap: 0.5,
		},
		tools: ["hand"],
		objective: { type: "sandbox" },
		stars: [NONE, NONE],
	};
}
