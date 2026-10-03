/** What the player has done and how they like the game set up. */
import { loadKey, saveKey } from "@/lib/storage";
import { LEVELS, WORLDS, levelsOfWorld } from "./levels";
import type { LevelDef, LevelResult } from "./types";

export type Settings = {
	sound: boolean;
	haptics: boolean;
	quality: "auto" | "low" | "medium" | "high";
};

export type Save = {
	/** best star count per level id */
	stars: Record<string, number>;
	/** best time per level id (seconds) */
	best: Record<string, number>;
	settings: Settings;
};

export const DEFAULT_SAVE: Save = {
	stars: {},
	best: {},
	settings: { sound: true, haptics: true, quality: "auto" },
};

/** Levels of a world that must be finished before the next world opens. */
export const WORLD_GATE = 4;
/** How many unfinished levels of a world are playable at once. */
const OPEN_AHEAD = 2;

export async function loadSave(): Promise<Save> {
	const s = await loadKey<Partial<Save>>("save");
	return {
		stars: { ...(s?.stars ?? {}) },
		best: { ...(s?.best ?? {}) },
		settings: { ...DEFAULT_SAVE.settings, ...(s?.settings ?? {}) },
	};
}

export function persist(save: Save) {
	void saveKey("save", save);
}

export function withResult(save: Save, r: LevelResult): Save {
	const stars = { ...save.stars };
	const best = { ...save.best };
	stars[r.levelId] = Math.max(stars[r.levelId] ?? 0, r.stars);
	const t = r.stats.time;
	if (best[r.levelId] === undefined || t < best[r.levelId]) best[r.levelId] = t;
	return { ...save, stars, best };
}

export function doneInWorld(save: Save, world: number): number {
	return levelsOfWorld(world).filter((l) => (save.stars[l.id] ?? 0) > 0).length;
}

export function starsInWorld(save: Save, world: number): number {
	return levelsOfWorld(world).reduce((n, l) => n + (save.stars[l.id] ?? 0), 0);
}

export function totalStars(save: Save): number {
	return LEVELS.reduce((n, l) => n + (save.stars[l.id] ?? 0), 0);
}

export function isWorldOpen(save: Save, world: number): boolean {
	if (world <= 1) return true;
	return doneInWorld(save, world - 1) >= WORLD_GATE;
}

/** A level is open if its world is, and it is one of the first few unfinished ones. */
export function isLevelOpen(save: Save, level: LevelDef): boolean {
	if (!isWorldOpen(save, level.world)) return false;
	if ((save.stars[level.id] ?? 0) > 0) return true;
	const unfinishedBefore = levelsOfWorld(level.world).filter(
		(l) => l.n < level.n && (save.stars[l.id] ?? 0) === 0,
	).length;
	return unfinishedBefore < OPEN_AHEAD;
}

/** The level "Play" should drop the player into: the first open one they have not finished. */
export function resumeLevel(save: Save): LevelDef {
	for (const l of LEVELS) if ((save.stars[l.id] ?? 0) === 0 && isLevelOpen(save, l)) return l;
	return LEVELS[0];
}

export const TOTAL_STARS = WORLDS.length * 6 * 3;
