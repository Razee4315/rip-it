import { describe, expect, it } from "vitest";
import { clamp, lerp } from "./math";

describe("math", () => {
	it("clamps", () => {
		expect(clamp(5, 0, 3)).toBe(3);
		expect(clamp(-1, 0, 3)).toBe(0);
	});
	it("lerps", () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
	});
});
