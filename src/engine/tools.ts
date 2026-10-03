export type ToolId =
	| "hand"
	| "scissors"
	| "blade"
	| "torch"
	| "water"
	| "cracker"
	| "pin"
	| "needle"
	| "blower";

export type ToolDef = {
	id: ToolId;
	name: string;
	/** one line shown when the tool is picked */
	hint: string;
	key: string;
	/** how a per-level limit on this tool is counted */
	unit: "uses" | "seconds";
};

export const TOOLS: Record<ToolId, ToolDef> = {
	hand: {
		id: "hand",
		name: "Hand",
		hint: "Grab and pull. Two fingers rip it apart.",
		key: "1",
		unit: "uses",
	},
	scissors: {
		id: "scissors",
		name: "Scissors",
		hint: "Drag to cut a clean line. Tap for a snip.",
		key: "2",
		unit: "uses",
	},
	blade: {
		id: "blade",
		name: "Blade",
		hint: "Slash fast. Slow strokes won't bite.",
		key: "3",
		unit: "uses",
	},
	torch: {
		id: "torch",
		name: "Torch",
		hint: "Hold to light it. Fire climbs.",
		key: "4",
		unit: "seconds",
	},
	water: {
		id: "water",
		name: "Water",
		hint: "Soak it: heavier, weaker, fireproof.",
		key: "5",
		unit: "seconds",
	},
	cracker: {
		id: "cracker",
		name: "Cracker",
		hint: "Tap to stick a firecracker. Stand back.",
		key: "6",
		unit: "uses",
	},
	pin: {
		id: "pin",
		name: "Pin",
		hint: "Tap to pin the cloth — or pull a pin out.",
		key: "7",
		unit: "uses",
	},
	needle: {
		id: "needle",
		name: "Needle",
		hint: "Drag along a tear to stitch it shut.",
		key: "8",
		unit: "uses",
	},
	blower: {
		id: "blower",
		name: "Blower",
		hint: "Hold for a blast of air.",
		key: "9",
		unit: "seconds",
	},
};

export const ALL_TOOLS: ToolId[] = [
	"hand",
	"scissors",
	"blade",
	"torch",
	"water",
	"cracker",
	"pin",
	"needle",
	"blower",
];
