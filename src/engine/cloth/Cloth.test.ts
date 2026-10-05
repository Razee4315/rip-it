import { describe, expect, it } from "vitest";
import { LEVELS } from "../../game/levels";
import { insidePolygon, shapePolygon } from "../gfx/prints";
import { Cloth, DT, MAX_FAN } from "./Cloth";
import { FABRICS } from "./fabrics";
import { type Mount, buildLayout } from "./layout";
import { Wind } from "./wind";

function make(
	fabric = FABRICS.cotton,
	cols = 12,
	rows = 10,
	mount: Mount = { kind: "batten" },
	w = 0.6,
	h = 0.5,
) {
	const lay = buildLayout(cols, rows, w, h, 0, 1.2, 0, mount);
	return new Cloth({
		cols,
		rows,
		width: w,
		height: h,
		fabric,
		positions: lay.positions,
		pins: lay.pins,
		floorY: 0,
		wallZ: -1,
	});
}

/** Flat orthographic "camera": 1000 px per metre, y down. */
function projectFlat(c: Cloth) {
	for (let p = 0; p < c.np; p++) {
		c.scr[p * 2] = c.pos[p * 3] * 1000 + 500;
		c.scr[p * 2 + 1] = (1.2 - c.pos[p * 3 + 1]) * 1000;
	}
}

/** Every cross-reference in the mesh must agree with every other. */
function validate(c: Cloth) {
	const errs: string[] = [];
	for (let t = 0; t < c.nt; t++) {
		if (!c.triAlive[t]) continue;
		for (let k = 0; k < 3; k++) {
			const v = c.tri[t * 3 + k];
			const v1 = c.tri[t * 3 + ((k + 1) % 3)];
			const opp = c.tri[t * 3 + ((k + 2) % 3)];
			if (!c.alive[v]) errs.push(`tri ${t} uses dead particle ${v}`);
			let inFan = false;
			for (let m = 0; m < c.fanN[v]; m++) if (c.fan[v * MAX_FAN + m] === t) inFan = true;
			if (!inFan) errs.push(`tri ${t} missing from fan of ${v}`);
			const e = c.triE[t * 3 + k];
			if (!c.eAlive[e]) errs.push(`tri ${t} edge ${e} dead`);
			const ok = (c.ea[e] === v && c.eb[e] === v1) || (c.ea[e] === v1 && c.eb[e] === v);
			if (!ok) errs.push(`tri ${t} edge ${k}=${e} endpoints ${c.ea[e]},${c.eb[e]} != ${v},${v1}`);
			if (c.eT0[e] === t) {
				if (c.eO0[e] !== opp) errs.push(`edge ${e} opp0 ${c.eO0[e]} != ${opp}`);
			} else if (c.eT1[e] === t) {
				if (c.eO1[e] !== opp) errs.push(`edge ${e} opp1 ${c.eO1[e]} != ${opp}`);
			} else errs.push(`edge ${e} does not list tri ${t}`);
		}
	}
	for (let e = 0; e < c.ne; e++) {
		if (!c.eAlive[e]) continue;
		if (c.eT0[e] < 0 || !c.triAlive[c.eT0[e]]) errs.push(`edge ${e} has no live tri`);
		if (c.eT1[e] >= 0 && !c.triAlive[c.eT1[e]]) errs.push(`edge ${e} lists dead tri1`);
		if (c.eT1[e] === c.eT0[e]) errs.push(`edge ${e} lists a tri twice`);
		if (c.eT1[e] >= 0 !== c.eBend[e] > 0) errs.push(`edge ${e} bend/adjacency mismatch`);
		if (!(c.eRest[e] > 0)) errs.push(`edge ${e} rest ${c.eRest[e]}`);
	}
	for (let p = 0; p < c.np; p++) {
		if (!c.alive[p]) continue;
		if (c.fanN[p] === 0) errs.push(`live particle ${p} has empty fan`);
		for (let m = 0; m < c.fanN[p]; m++) {
			const t = c.fan[p * MAX_FAN + m];
			if (!c.triAlive[t]) errs.push(`fan of ${p} lists dead tri ${t}`);
			if (c.tri[t * 3] !== p && c.tri[t * 3 + 1] !== p && c.tri[t * 3 + 2] !== p)
				errs.push(`fan of ${p} lists tri ${t} that does not use it`);
		}
		for (let k = 0; k < 3; k++)
			if (!Number.isFinite(c.pos[p * 3 + k])) errs.push(`particle ${p} position is not finite`);
	}
	return errs;
}

function run(c: Cloth, seconds: number, wind: Wind | null = null) {
	const steps = Math.round(seconds / DT);
	for (let s = 0; s < steps; s++) {
		if (s % 12 === 0) {
			wind?.update(12 * DT);
			c.prepare(wind);
			c.updateState(12 * DT);
		}
		c.substep();
	}
}

describe("cloth topology", () => {
	it("starts as one sound piece", () => {
		const c = make();
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.pieces).toBe(1);
		expect(c.hangingArea).toBeCloseTo(c.initialArea, 6);
		expect(c.initialArea).toBeCloseTo(0.6 * 0.5, 5);
	});

	it("a straight cut across makes two pieces and drops the lower one", () => {
		const c = make();
		projectFlat(c);
		c.beginStroke();
		const n = c.cutSegment(150, 262, 850, 262, 0.2);
		expect(n).toBeGreaterThan(8);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.pieces).toBe(2);
		expect(c.aliveArea).toBeCloseTo(c.initialArea, 5);
		expect(c.hangingArea).toBeGreaterThan(c.initialArea * 0.4);
		expect(c.hangingArea).toBeLessThan(c.initialArea * 0.62);
	});

	it("cuts at any angle stay straight (vertices slide onto the blade)", () => {
		const c = make();
		projectFlat(c);
		c.beginStroke();
		c.cutSegment(180, -20, 760, 540, 0.2);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.pieces).toBe(2);
		expect(c.aliveArea).toBeCloseTo(c.initialArea, 5);
		// every split particle should lie on the cut line in material space
		let off = 0,
			cnt = 0;
		const seen = new Map<number, number>();
		for (let p = 0; p < c.np; p++) {
			if (!c.alive[p]) continue;
			const o = c.origin[p];
			if (seen.has(o)) {
				const x = c.scr[p * 2],
					y = c.scr[p * 2 + 1];
				// distance from the stroke line
				const dx = 760 - 180,
					dy = 540 + 20;
				const d = Math.abs((x - 180) * dy - (y + 20) * dx) / Math.hypot(dx, dy);
				off += d;
				cnt++;
			}
			seen.set(o, p);
		}
		expect(cnt).toBeGreaterThan(6);
		expect(off / cnt).toBeLessThan(6);
	});

	it("a stroke made of several segments is one continuous cut", () => {
		const c = make();
		projectFlat(c);
		c.beginStroke();
		const pts = [
			[150, 200],
			[320, 230],
			[480, 215],
			[640, 260],
			[850, 240],
		];
		for (let i = 1; i < pts.length; i++)
			c.cutSegment(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0.2);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.pieces).toBe(2);
	});

	it("a short snip in the middle does not sever anything", () => {
		const c = make();
		projectFlat(c);
		c.beginStroke();
		c.cutSegment(400, 250, 560, 250, 0.2);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.pieces).toBe(1);
	});

	it.each(LEVELS.filter((l) => l.objective.type === "cutout"))(
		"following the printed guide frees $id in portrait and landscape",
		(level) => {
			for (const size of [{ w: level.cloth.w, h: level.cloth.h }, level.cloth.tall!]) {
				const cols = Math.round(size.w / 0.042),
					rows = Math.round(size.h / 0.042);
				const c = make(
					FABRICS[level.cloth.fabric],
					cols,
					rows,
					level.cloth.mount,
					cols * 0.042,
					rows * 0.042,
				);
				const target = level.cloth.target!;
				const poly = shapePolygon(target, c.width / c.height);
				c.tagRegion((u, v) => insidePolygon(poly, u, v));
				const guide = shapePolygon({ ...target, r: target.r * 1.13 }, c.width / c.height);
				const points: number[][] = [];
				for (let i = 0; i < guide.length; i++) {
					const a = guide[i],
						b = guide[(i + 1) % guide.length];
					for (let k = 0; k < 4; k++)
						points.push([
							500 + (a[0] + ((b[0] - a[0]) * k) / 4 - 0.5) * c.width * 1000,
							(a[1] + ((b[1] - a[1]) * k) / 4) * c.height * 1000,
						]);
				}
				points.push(points[0]);
				projectFlat(c);
				c.beginStroke();
				for (let i = 1; i < points.length; i++)
					c.cutSegment(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], 0.12);
				c.analyze();
				expect(validate(c)).toEqual([]);
				expect(c.pieces).toBe(2);
				let quality = 0;
				for (let p = 0; p < c.np; p++) {
					if (c.alive[p] && c.parent[p] === p && !c.compPin[p]) {
						quality = Math.max(
							quality,
							(c.compTag[p] / c.targetArea) * (c.compTag[p] / c.compArea[p]),
						);
					}
				}
				expect(quality).toBeGreaterThan(0.84);
			}
		},
	);

	it("sewing a fresh cut heals it completely", () => {
		const c = make();
		projectFlat(c);
		c.beginStroke();
		c.cutSegment(150, 262, 850, 262, 0.2);
		expect(c.countSplits()).toBeGreaterThan(8);
		for (let x = 150; x <= 850; x += 20) c.sewAt(x, 262, 60);
		expect(validate(c)).toEqual([]);
		expect(c.countSplits()).toBe(0);
		c.analyze();
		expect(c.pieces).toBe(1);
	});

	it.each([6, 10])("%i strips separate when sampled cuts meet the exact hems", (count) => {
		for (const [width, height] of [
			[1, 1.35],
			[1.6, 0.95],
		]) {
			const cols = Math.round(width / 0.042),
				rows = Math.round(height / 0.042);
			const c = make(FABRICS.silk, cols, rows, { kind: "batten" }, cols * 0.042, rows * 0.042);
			const cuts: number[] = [];
			for (let strip = 1; strip < count; strip++) {
				projectFlat(c);
				c.beginStroke();
				const y = (c.height * 1000 * strip) / count;
				let n = 0;
				for (let sample = 1; sample <= 40; sample++) {
					const x0 = 500 + ((sample - 1) / 40 - 0.5) * c.width * 1000;
					const x1 = 500 + (sample / 40 - 0.5) * c.width * 1000;
					n += c.cutSegment(x0, y, x1, y, 0.12);
				}
				c.endStroke();
				c.analyze(c.initialArea * 0.035);
				cuts.push(n, c.pieces);
			}
			c.analyze(c.initialArea * 0.035);
			expect(c.pieces, JSON.stringify({ width, height, cuts })).toBe(count);
			expect(validate(c)).toEqual([]);
		}
	});

	it("killing triangles keeps the mesh consistent", () => {
		const c = make();
		for (let t = 0; t < c.nt; t += 3) c.killTri(t);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.aliveArea).toBeLessThan(c.initialArea * 0.7);
		for (let t = 0; t < c.nt; t++) c.killTri(t);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.aliveArea).toBe(0);
	});
});

describe("cloth behaviour", () => {
	it.each(Object.keys(FABRICS) as (keyof typeof FABRICS)[])(
		"a side cut in %s cannot start a remote rip at a stressed peg",
		(id) => {
			const c = make(FABRICS[id], 24, 20, { kind: "line", pegs: 4 }, 1.2, 1);
			c.settle(0.5, null);
			projectFlat(c);
			c.beginStroke();
			expect(c.cutSegment(900, 650, 1150, 650, 0.5)).toBeGreaterThan(0);
			// A very weak thread near the opposite mount reproduces residual solver stress.
			for (let e = 0; e < c.ne; e++) {
				const a = c.ea[e];
				if (c.uv[a * 2] < 0.2 && c.uv[a * 2 + 1] < 0.2 && c.eAlive[e]) {
					c.eThr[e] = 1.00001;
					c.eRest[e] *= 0.7;
				}
			}
			run(c, 1.2);
			expect(c.tearCount).toBe(0);
			expect(validate(c)).toEqual([]);
		},
	);

	it("a local blast does not authorize fracture on the opposite side", () => {
		const c = make(FABRICS.cotton, 30, 20, { kind: "batten" }, 1.5, 1);
		c.settle(0.4, null);
		c.explode(0.6, 0.5, 0, 0.12, 0);
		for (let e = 0; e < c.ne; e++) {
			const a = c.ea[e];
			if (c.uv[a * 2] < 0.15 && c.eAlive[e]) {
				c.eThr[e] = 1.00001;
				c.eRest[e] *= 0.7;
			}
		}
		// Inspect the onset, before a real crack has time to run across connected fabric.
		run(c, 6 * DT);
		for (let p = c.n0; p < c.np; p++) {
			if (c.alive[p]) expect(c.uv[p * 2]).toBeGreaterThan(0.2);
		}
		expect(validate(c)).toEqual([]);
	});

	it.each(["cotton", "silk", "paper"] as const)(
		"%s stays stable in still air after settling",
		(id) => {
			const c = make(FABRICS[id], 23, 30, { kind: "line", pegs: 3 }, 0.966, 1.26);
			c.floorY = -1;
			c.settle(1.1, null);
			const rest = c.pos.slice(0, c.np * 3);
			const calm = new Wind();
			calm.set(0, 0, 0, 0, 0);
			let peakSpeed = 0;
			// Match idle gameplay: 24 fixed substeps per 30 Hz render frame.
			for (let frame = 0; frame < 180; frame++) {
				c.prepare(calm);
				for (let step = 0; step < 24; step++) c.substep();
				for (let p = 0; p < c.np; p++) {
					peakSpeed = Math.max(
						peakSpeed,
						Math.hypot(c.vel[p * 3], c.vel[p * 3 + 1], c.vel[p * 3 + 2]),
					);
				}
			}
			let drift = 0;
			for (let p = 0; p < c.np; p++)
				drift = Math.max(
					drift,
					Math.hypot(
						c.pos[p * 3] - rest[p * 3],
						c.pos[p * 3 + 1] - rest[p * 3 + 1],
						c.pos[p * 3 + 2] - rest[p * 3 + 2],
					),
				);
			expect(peakSpeed).toBeLessThan(1);
			expect(drift).toBeLessThan(0.2);
			expect(c.tearCount).toBe(0);
			expect(validate(c)).toEqual([]);
		},
	);

	it.each(["cotton", "silk", "paper"] as const)(
		"holding and gently moving %s does not rip it",
		(id) => {
			const c = make(FABRICS[id], 40, 28, { kind: "rod", clips: 9, gather: 0.86 }, 1.44, 1.008);
			const wind = new Wind();
			wind.set(0.35, 0, -0.1, 0.5, 0.25);
			c.settle(1.1, wind);
			const p = 18 * 41 + 20;
			const g = c.grab(c.pos[p * 3], c.pos[p * 3 + 1], c.pos[p * 3 + 2], 0.076);
			expect(g).not.toBeNull();
			if (!g) return;
			run(c, 0.5, wind);
			g.tx += 0.02;
			run(c, 0.5, wind);
			expect(c.tearCount).toBe(0);
			expect(validate(c)).toEqual([]);
		},
	);

	it("no fabric tears or sags badly under its own weight", () => {
		for (const id of ["silk", "cotton", "latex", "mail"] as const) {
			const c = make(
				FABRICS[id],
				28,
				24,
				{ kind: "rod", clips: 7, gather: 0.86 },
				28 * 0.036,
				24 * 0.036,
			);
			c.floorY = -5;
			c.settle(0.5, null);
			run(c, 1);
			expect(c.tearCount, `${id} tore itself`).toBe(0);
			expect(validate(c), id).toEqual([]);
			// still cloth-shaped, not a puddle of stretch
			let minY = 9;
			for (let p = 0; p < c.np; p++) if (c.alive[p]) minY = Math.min(minY, c.pos[p * 3 + 1]);
			const drop = 1.2 - minY;
			const rest = 24 * 0.036;
			expect(drop, `${id} hang length`).toBeGreaterThan(rest * 0.9);
			expect(drop, `${id} hang length`).toBeLessThan(rest * (id === "latex" ? 1.5 : 1.12));
		}
	});

	it("wind alone never starts a rip, whatever the mount", () => {
		const mounts: Mount[] = [
			{ kind: "rod", clips: 7, gather: 0.86 },
			{ kind: "line", pegs: 4 },
			{ kind: "pole" },
		];
		for (const id of ["silk", "paper"] as const)
			for (const mount of mounts) {
				const c = make(FABRICS[id], 26, 20, mount, 26 * 0.036, 20 * 0.036);
				c.floorY = -5;
				const wind = new Wind();
				wind.set(3.2, 0, -0.8, 0.7, 0.9);
				c.settle(0.4, wind);
				run(c, 1.5, wind);
				expect(c.tearCount, `${id} on ${mount.kind} tore in the wind`).toBe(0);
				expect(validate(c), id).toEqual([]);
			}
	});

	it("a hard pull rips cotton but not leather", () => {
		for (const [id, shouldTear] of [
			["cotton", true],
			["paper", true],
			["leather", false],
		] as const) {
			const c = make(FABRICS[id], 20, 16, { kind: "batten" }, 0.8, 0.64);
			c.floorY = -5;
			c.settle(0.4, null);
			const g = c.grab(0, 1.2 - 0.6, 0, 0.07);
			expect(g).not.toBeNull();
			if (!g) continue;
			// drag the hand well below the hem over half a second
			for (let s = 0; s < 480; s++) {
				g.ty = 0.6 - Math.min(1, s / 240) * 0.7;
				if (s % 8 === 0) c.prepare(null);
				c.substep();
			}
			expect(validate(c), id).toEqual([]);
			if (shouldTear) expect(c.tearCount, `${id} should rip`).toBeGreaterThan(3);
			else expect(c.tearCount, `${id} should hold`).toBe(0);
		}
	});

	it("the opening towel can be torn into two substantial pieces", () => {
		const c = make(FABRICS.cotton, 31, 21, { kind: "line", pegs: 3 }, 31 * 0.042, 21 * 0.042);
		c.settle(1.1, null);
		const p = 14 * 32 + 15;
		const g = c.grab(c.pos[p * 3], c.pos[p * 3 + 1], c.pos[p * 3 + 2], 0.088);
		expect(g).not.toBeNull();
		if (!g) return;
		for (let step = 0; step < 1440; step++) {
			g.tx = g.sx + Math.min(1, step / 360) * 0.8;
			g.ty = g.sy - Math.min(1, step / 360) * 0.4;
			if (step % 12 === 0) c.prepare(null);
			c.substep();
		}
		c.analyze(c.initialArea * 0.035);
		expect(c.pieces).toBeGreaterThanOrEqual(2);
		expect(validate(c)).toEqual([]);
	});

	it("a notch lets a tough fabric rip", () => {
		const c = make(FABRICS.denim, 20, 16, { kind: "batten" }, 0.8, 0.64);
		c.floorY = -5;
		c.settle(0.4, null);
		projectFlat(c);
		c.beginStroke();
		// snip in from the left edge at mid height
		c.cutSegment(60, 300, 300, 300, 0.2);
		c.endStroke();
		const g = c.grab(-0.36, 1.2 - 0.42, 0, 0.07);
		expect(g).not.toBeNull();
		if (!g) return;
		for (let s = 0; s < 600; s++) {
			g.ty = 0.78 - Math.min(1, s / 240) * 0.8;
			if (s % 8 === 0) c.prepare(null);
			c.substep();
		}
		expect(validate(c)).toEqual([]);
		expect(c.tearCount).toBeGreaterThan(2);
	});

	it("fire spreads, consumes the cloth and never corrupts the mesh", () => {
		const c = make(FABRICS.paper, 14, 12);
		projectFlat(c);
		c.heatAt(500, 480, 60, 5);
		expect(c.burning.some((b) => b === 1)).toBe(true);
		run(c, 6);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.burntArea).toBeGreaterThan(c.initialArea * 0.5);
	});

	it("wet cloth will not light", () => {
		const c = make(FABRICS.cotton, 14, 12);
		projectFlat(c);
		c.wetAt(500, 300, 900, 1);
		c.heatAt(500, 300, 80, 5);
		expect(c.burning.some((b) => b === 1)).toBe(false);
	});

	it("an explosion blows a hole without breaking invariants", () => {
		const c = make(FABRICS.cotton, 20, 16, { kind: "batten" }, 0.8, 0.64);
		c.explode(0, 0.9, 0.02, 0.3, 40);
		run(c, 0.5);
		expect(validate(c)).toEqual([]);
		c.analyze();
		expect(c.aliveArea).toBeLessThan(c.initialArea);
	});
});
