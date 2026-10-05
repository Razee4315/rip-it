import type { FabricId } from "@/engine/cloth/fabrics";
import type { Mount } from "@/engine/cloth/layout";
import type { EnvId } from "@/engine/gfx/environments";
import type { PrintSpec, Shape } from "@/engine/gfx/prints";
import type { ToolId } from "@/engine/tools";

export type ClothDef = {
	fabric: FabricId;
	/** size in metres on a wide screen */
	w: number;
	h: number;
	/** size to use on a tall (portrait) screen */
	tall?: { w: number; h: number };
	mount: Mount;
	print: PrintSpec;
	/** dye the threads this colour instead of the fabric's natural one (sRGB hex) */
	dye?: string;
	/** the marked region objectives refer to (usually the print's emblem) */
	target?: Shape;
	/** clearance between the hem and the floor */
	gap?: number;
};

export type ArtKind = "sunset" | "night" | "wave";

export type PreOp =
	/** slash the cloth before play: polyline in uv */
	| { op: "cut"; pts: [number, number][] }
	/** soak a disc: centre and radius in uv (radius relative to width) */
	| { op: "wet"; u: number; v: number; r: number };

export type Objective =
	/** tear it into at least this many real pieces */
	| { type: "pieces"; count: number }
	/** get this fraction off the mount — fallen or destroyed */
	| { type: "clear"; pct: number }
	/** burn away this fraction */
	| { type: "burn"; pct: number }
	/** cut the marked shape free in one piece */
	| { type: "cutout" }
	/** clear `clear` of the plain cloth while `keep` of the emblem stays hanging and whole */
	| { type: "protect"; clear: number; keep: number }
	/** uncover this fraction of the hidden picture */
	| { type: "reveal"; pct: number }
	/** stitch every tear closed */
	| { type: "mend" }
	| { type: "sandbox" };

export type RunStats = {
	/** seconds from first touch */
	time: number;
	/** cutting strokes made (scissors, blade) */
	strokes: number;
	/** fibres ripped by force */
	tears: number;
	/** objective-specific quality 0..1 (cut accuracy, emblem intact, …) */
	quality: number;
	pieces: number;
	/** fraction of the cloth that burnt */
	burnt: number;
	/** tool uses: strokes / placements, or seconds for held tools */
	used: Partial<Record<ToolId, number>>;
};

export type StarRule = {
	label: string;
	test: (r: RunStats) => boolean;
};

export type LevelDef = {
	id: string;
	world: number;
	n: number;
	name: string;
	/** the goal, in a few words */
	brief: string;
	tip?: string;
	env: EnvId;
	cloth: ClothDef;
	tools: ToolId[];
	/** caps on tool use: strokes / placements, or seconds for held tools */
	limits?: Partial<Record<ToolId, number>>;
	objective: Objective;
	timeLimit?: number;
	/** conditions for the second and third star (the first is finishing) */
	stars: [StarRule, StarRule];
	art?: ArtKind;
	pre?: PreOp[];
};

export type LevelResult = {
	levelId: string;
	stars: number;
	/** which of the three stars were earned */
	earned: [boolean, boolean, boolean];
	stats: RunStats;
};

export type HudState = {
	/** 0..1 toward the objective */
	progress: number;
	/** short readout, e.g. "2 / 4" or "63%" */
	readout: string;
	time: number;
	timeLeft: number | null;
	/** remaining allowance per limited tool */
	left: Partial<Record<ToolId, number>>;
	/** secondary meter for objectives with something to protect (0..1), else -1 */
	guard: number;
	fps: number;
	started: boolean;
};
