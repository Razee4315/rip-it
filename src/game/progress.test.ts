import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE, normalizeSave, normalizeSettings, totalStars } from "./progress";

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

describe("saved campaign progress", () => {
	it("keeps good results while rejecting corrupt counts and times", () => {
		const save = normalizeSave({
			stars: { "1-1": 3, "1-2": "two", "1-3": Number.NaN, "1-4": 9, "1-5": -1, removed: 3 },
			best: { "1-1": 4.5, "1-2": -8, "1-3": Number.POSITIVE_INFINITY, "1-4": "fast" },
			settings: { music: true },
		});
		expect(save.stars).toEqual({ "1-1": 3, "1-4": 3, "1-5": 0 });
		expect(save.best).toEqual({ "1-1": 4.5 });
		expect(totalStars(save)).toBe(6);
		expect(save.settings.music).toBe(true);
	});
	it.each([null, "broken", [], { stars: "bad", best: [12] }])(
		"recovers a malformed save: %j",
		(value) => {
			expect(normalizeSave(value)).toEqual(DEFAULT_SAVE);
		},
	);
});
