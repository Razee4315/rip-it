/**
 * Development-only campaign smoke check. Evaluate this file as JavaScript in the
 * running Vite page (the collaborative preview's evaluate tool works). It uses
 * the real cloth, camera and objective evaluator, with repeatable tool paths.
 * This checks engine playability; it does not replace real pointer/UI testing.
 */
(async () => {
	const canvas = document.querySelector("canvas");
	let fiber = canvas[Object.keys(canvas).find((k) => k.startsWith("__reactFiber"))];
	let game;
	while (fiber) {
		if (fiber.type?.name === "App") {
			let hook = fiber.memoizedState;
			while (hook) {
				if (hook.memoizedState?.current?.cloth) game = hook.memoizedState.current;
				hook = hook.next;
			}
		}
		fiber = fiber.return;
	}
	if (!game) throw new Error("Open the development game first");
	const { LEVELS } = await import("/src/game/levels.ts");
	const { shapePolygon } = await import("/src/engine/gfx/prints.ts");
	const original = game.level,
		callbacks = game.cb,
		paused = game.paused;
	const insets = [game.insetTop, game.insetBottom];
	game.stop();
	game.cb = {};
	const results = [];
	window.campaignQAResults = results;
	const run = (seconds) => {
		const c = game.cloth;
		for (let f = 0; f < Math.round(seconds * 60); f++) {
			c.prepare(game.wind);
			for (let s = 0; s < 12; s++) c.substep();
			c.updateState(1 / 60);
			if (game.state === "playing") game.stats.time += 1 / 60;
			if (f % 10 === 0) game.evaluate();
		}
		game.evaluate();
	};
	const screen = (u, v) => {
		const c = game.cloth;
		c.project(game.renderer.vp, game.cssW, game.cssH);
		for (let t = 0; t < c.nt; t++) {
			if (!c.triAlive[t]) continue;
			const ids = [c.tri[t * 3], c.tri[t * 3 + 1], c.tri[t * 3 + 2]];
			const p = ids.map((i) => [c.uv[i * 2], c.uv[i * 2 + 1]]);
			const den =
				(p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
			const a = ((p[1][1] - p[2][1]) * (u - p[2][0]) + (p[2][0] - p[1][0]) * (v - p[2][1])) / den;
			const b = ((p[2][1] - p[0][1]) * (u - p[2][0]) + (p[0][0] - p[2][0]) * (v - p[2][1])) / den;
			const w = [a, b, 1 - a - b];
			if (w.every((x) => x >= -1e-5))
				return [0, 1].map((axis) => ids.reduce((sum, i, k) => sum + c.scr[i * 2 + axis] * w[k], 0));
		}
		return null;
	};
	const cut = (points) => {
		const c = game.cloth;
		const dense = points.flatMap((p, i) =>
			i === points.length - 1
				? [p]
				: Array.from({ length: 20 }, (_, k) =>
						p.map((x, j) => x + ((points[i + 1][j] - x) * k) / 20),
					),
		);
		c.beginStroke();
		let previous = screen(...dense[0]),
			n = 0;
		for (const uv of dense.slice(1)) {
			const next = screen(...uv);
			if (next && previous) n += c.cutSegment(...previous, ...next, 0.12);
			previous = next;
		}
		c.endStroke();
		if (n) game.stats.strokes++;
		return n;
	};
	const pull = (u, v, duration, dx, dy) => {
		const c = game.cloth,
			point = screen(u, v);
		if (!point) return;
		const p = c.pickScreen(...point, 10);
		if (p < 0) return;
		const grab = c.grab(...c.pos.slice(p * 3, p * 3 + 3), 0.076);
		if (!grab) return;
		const x = grab.tx,
			y = grab.ty,
			frames = Math.round(duration * 60);
		for (let i = 1; i <= frames; i++) {
			grab.tx = x + (dx * i) / frames;
			grab.ty = y + (dy * i) / frames;
			run(1 / 60);
		}
		c.release(grab);
		run(0.1);
	};
	const pullRemaining = (twoHands) => {
		const c = game.cloth;
		c.analyze(c.initialArea * 0.035);
		let root = -1,
			area = 0;
		for (let p = 0; p < c.np; p++)
			if (c.alive[p] && c.parent[p] === p && c.compArea[p] > area) {
				root = p;
				area = c.compArea[p];
			}
		const candidates = [];
		for (let p = 0; p < c.np; p++)
			if (c.alive[p] && !c.pin[p] && c.find(p) === root) candidates.push(p);
		if (!candidates.length) return;
		candidates.sort((a, b) => c.pos[a * 3] - c.pos[b * 3]);
		const p = twoHands
			? candidates[Math.floor(candidates.length * 0.8)]
			: candidates.reduce((best, v) => {
					const depth = (n) =>
						Math.min(c.uv[n * 2], 1 - c.uv[n * 2], c.uv[n * 2 + 1], 1 - c.uv[n * 2 + 1]);
					return depth(v) > depth(best) ? v : best;
				});
		const q = candidates[Math.floor(candidates.length * 0.2)];
		const anchor = twoHands ? c.grab(...c.pos.slice(q * 3, q * 3 + 3), 0.06) : null;
		const grab = c.grab(...c.pos.slice(p * 3, p * 3 + 3), 0.06);
		if (grab) {
			const x = grab.tx,
				y = grab.ty;
			const frames = twoHands ? 24 : 48,
				dx = twoHands ? 0.5 : 0.9,
				dy = twoHands ? 0.25 : 0.4;
			for (let i = 1; i <= frames; i++) {
				grab.tx = x + (dx * i) / frames;
				grab.ty = y - (dy * i) / frames;
				run(1 / 60);
			}
			c.release(grab);
		}
		if (anchor) c.release(anchor);
		run(0.1);
	};
	try {
		for (const [width, height] of [
			[375, 667],
			[1280, 800],
		]) {
			game.resize(width, height);
			game.setInsets(78, 150);
			for (const level of LEVELS) {
				game.load(level);
				game.started = true;
				const c = game.cloth,
					objective = level.objective;
				let fuel = 0,
					water = 0;
				if (objective.type === "cutout") {
					const shape = level.cloth.target;
					const poly = shapePolygon({ ...shape, r: shape.r * 1.13 }, c.width / c.height);
					cut([...poly, poly[0]]);
				} else if (objective.type === "mend") {
					for (let pass = 0; pass < 4; pass++) {
						c.project(game.renderer.vp, width, height);
						for (let p = 0; p < c.np; p++)
							if (c.alive[p] && c.fray[p] > 0) c.sewAt(c.scr[p * 2], c.scr[p * 2 + 1], 38);
					}
				} else if (objective.type === "protect" && level.id !== "3-3") {
					const s = level.cloth.target,
						l = s.cx - s.r * 1.13,
						r = s.cx + s.r * 1.13,
						b = s.cy + s.r * 1.2;
					cut([
						[l, 0],
						[l, b],
						[r, b],
						[r, 0],
					]);
					cut([
						[0, 0.06],
						[l + 0.035, 0.06],
					]);
					cut([
						[r - 0.035, 0.06],
						[1, 0.06],
					]);
				} else if (objective.type === "burn" || level.id === "3-3") {
					const ppm = height / (2 * Math.tan(Math.PI / 12) * game.camPos[2]);
					if (level.id === "3-3") {
						const s = level.cloth.target,
							spots = [];
						for (const du of [-0.12, 0, 0.12])
							for (const dv of [-0.12, 0, 0.12]) spots.push([s.cx + du, s.cy + dv]);
						for (let v = 0.02; v < s.cy - 0.1; v += 0.065) spots.push([s.cx, v]);
						for (const uv of spots) {
							c.wetAt(...screen(...uv), 0.1 * ppm, 0.9);
							water += 0.9 / 2.4;
						}
					}
					const spots =
						level.id === "3-3"
							? [
									[0.1, 0.82],
									[0.32, 0.82],
									[0.65, 0.82],
									[0.9, 0.82],
									[0.06, 0.3],
									[0.94, 0.3],
									[0.04, 0.1],
									[0.96, 0.1],
								]
							: level.id === "3-2"
								? [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].flatMap((u) => [
										[u, 0.9],
										[u, 0.26],
									])
								: [
										[0.12, 0.84],
										[0.37, 0.84],
										[0.63, 0.84],
										[0.88, 0.84],
										[0.15, 0.23],
										[0.5, 0.23],
										[0.85, 0.23],
									];
					const dose = level.id === "3-2" ? 1.4 : 0.95;
					for (const uv of spots) {
						c.heatAt(...screen(...uv), 0.07 * ppm, dose);
						fuel += dose / 3.4;
					}
					run(16);
				} else if (level.id === "3-4") {
					const pins = [];
					for (let p = 0; p < c.np; p++)
						if (c.pin[p]) pins.push([...c.pos.slice(p * 3, p * 3 + 3)]);
					for (const p of pins) {
						game.explode(p[0], p[1] - 0.03, p[2] + 0.02);
						fuel++;
						run(1.5);
					}
				} else if (level.tools[0] === "blade" && objective.type === "pieces") {
					for (let i = 1; i < objective.count; i++)
						cut([
							[0, i / objective.count],
							[1, i / objective.count],
						]);
				} else if (["1-3", "2-1", "2-5"].includes(level.id)) {
					cut([
						[0, 0.05],
						[1, 0.05],
					]);
				} else if (level.id === "1-6") {
					for (const v of [0.35, 0.64])
						cut([
							[0, v],
							[0.25, v],
						]);
					for (let k = 0; k < 12 && game.state === "playing"; k++)
						pull(0.24, k % 2 ? 0.7 : 0.42, 0.6, 0.4, -0.35);
				} else if (level.id === "1-5") {
					for (let k = 0; k < 20 && game.state === "playing"; k++) pullRemaining(true);
				} else if (level.id === "4-1") {
					for (let k = 0; k < 50 && game.state === "playing"; k++)
						pull(
							[0.1, 0.3, 0.5, 0.7, 0.9][k % 5],
							[0.1, 0.3, 0.5, 0.7, 0.9][Math.floor(k / 5) % 5],
							0.3,
							k % 2 ? -0.9 : 0.9,
							-0.4,
						);
				} else {
					for (let k = 0; k < 12 && game.state === "playing"; k++)
						pull([0.5, 0.2, 0.8][k % 3], [0.65, 0.45, 0.25][Math.floor(k / 3) % 3], 0.8, 0.9, -0.4);
				}
				run(3);
				const finite = c.pos.subarray(0, c.np * 3).every(Number.isFinite);
				const withinBudget =
					fuel <= (level.limits?.torch ?? level.limits?.cracker ?? Infinity) &&
					water <= (level.limits?.water ?? Infinity) &&
					game.stats.strokes <= (level.limits?.scissors ?? Infinity) &&
					game.stats.time <= (level.timeLimit ?? Infinity);
				results.push({
					size: `${width}x${height}`,
					id: level.id,
					state: game.state,
					quality: +game.stats.quality.toFixed(3),
					progress: +game.progress.toFixed(3),
					cuts: game.stats.strokes,
					time: +game.stats.time.toFixed(2),
					fuel: +fuel.toFixed(2),
					water: +water.toFixed(2),
					finite,
					withinBudget,
				});
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}
	} finally {
		game.resize(innerWidth, innerHeight);
		game.setInsets(...insets);
		game.cb = callbacks;
		game.load(original);
		game.setPaused(paused);
		game.start();
	}
	return results;
})();
