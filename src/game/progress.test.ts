import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, normalizeSettings } from "./progress";

describe("settings compatibility", () => {
	it("preserves existing preferences and fills in new controls", () => {
		expect(normalizeSettings({ sound: false, haptics: false, quality: "high" })).toEqual({
			...DEFAULT_SAVE.settings,
			sound: false,
			haptics: false,
			quality: "high",
		});
	});
	it("validates volume without losing independent audio preferences", () => {
		expect(normalizeSettings({ volume: 9, music: true, ambience: false })).toMatchObject({
			volume: 1,
			music: true,
			ambience: false,
		});
		expect(normalizeSettings({ volume: -1 }).volume).toBe(0);
		for (const volume of [Number.NaN, Number.POSITIVE_INFINITY, "0.5", null])
			expect(normalizeSettings({ volume }).volume).toBe(DEFAULT_SAVE.settings.volume);
	});
	it("recovers from invalid saved settings", () => {
		expect(normalizeSettings({ quality: "ultra", sound: "no", haptics: null })).toEqual(
			DEFAULT_SAVE.settings,
		);
		expect(normalizeSettings(null)).toEqual(DEFAULT_SAVE.settings);
	});
});
