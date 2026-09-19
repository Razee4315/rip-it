export type ToolId = "hand" | "scissors" | "knife" | "torch" | "water" | "pin" | "needle" | "fan";

export type ToolDef = {
	id: ToolId;
	icon: string;
	name: string;
	key: string;
	tip: string;
	dock?: "primary" | "overflow";
};

/** Primary dock: Hand / Scissors / Knife / Torch / Water. Overflow: Pin / Sew / Blower. */
export const TOOLS: ToolDef[] = [
	{
		id: "hand",
		icon: "hand",
		name: "Hand",
		key: "1",
		tip: "Pinch and pull",
		dock: "primary",
	},
	{
		id: "scissors",
		icon: "scissors",
		name: "Scissors",
		key: "2",
		tip: "Click to snip, or hold and drag to cut a clean line.",
		dock: "primary",
	},
	{
		id: "knife",
		icon: "knife",
		name: "Knife",
		key: "3",
		tip: "SLASH fast to cut. Slow moves just nudge the fabric.",
		dock: "primary",
	},
	{
		id: "torch",
		icon: "torch",
		name: "Torch",
		key: "4",
		tip: "Hold to ignite. Wet cloth will not burn.",
		dock: "primary",
	},
	{
		id: "water",
		icon: "water",
		name: "Water",
		key: "5",
		tip: "Soak it: heavier, sags, tears easier, fire-proof.",
		dock: "primary",
	},
	{
		id: "pin",
		icon: "pin",
		name: "Pin",
		key: "6",
		tip: "Click to pin the cloth down — or unclip it from the rod.",
		dock: "overflow",
	},
	{
		id: "needle",
		icon: "needle",
		name: "Sew",
		key: "7",
		tip: "Stitch torn seams back together.",
		dock: "overflow",
	},
	{
		id: "fan",
		icon: "fan",
		name: "Blower",
		key: "8",
		tip: "Hold to blast a gust of air.",
		dock: "overflow",
	},
];

export const PRIMARY_TOOLS = TOOLS.filter((t) => t.dock === "primary");
export const OVERFLOW_TOOLS = TOOLS.filter((t) => t.dock === "overflow");
