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
	it("recovers from invalid saved settings", () => {
		expect(normalizeSettings({ quality: "ultra", sound: "no", haptics: null })).toEqual(
			DEFAULT_SAVE.settings,
		);
		expect(normalizeSettings(null)).toEqual(DEFAULT_SAVE.settings);
	});
});
