/**
 * Everything dyed, printed or stitched onto a cloth, painted into one canvas.
 * The renderer multiplies this over the woven thread colours.
 */
import { hash01 } from "../math";

export type ShapeKind = "heart" | "star" | "circle" | "diamond" | "shield";

/** A shape on the cloth in uv space. `r` is a fraction of the cloth's width. */
export type Shape = { kind: ShapeKind; cx: number; cy: number; r: number };

export type Pattern =
	| { kind: "gingham"; color: string; cell?: number }
	| { kind: "stripes"; color: string; cell?: number; horizontal?: boolean }
	| { kind: "tartan"; color: string; color2: string; cell?: number }
	| { kind: "dots"; color: string; cell?: number }
	| { kind: "bands"; colors: string[] }
	| { kind: "wash" }
	| { kind: "ruled"; color: string };

export type PrintSpec = {
	/** overall dye, multiplied with the thread colour */
	base?: string;
	pattern?: Pattern;
	emblem?: {
		shape: Shape;
		fill: string;
		/** inner motif colour */
		detail?: string;
		/** draw a dashed "cut here" guide around it */
		guide?: boolean;
	};
	text?: { str: string; color: string; size: number; cy: number; stencil?: boolean; sub?: string };
	/** stitched hem: thread colour */
	hem?: string;
	/** 0..1 stains and wear */
	age?: number;
	/** trim band along the bottom (fringe, border) */
	trim?: string;
};

/** Outline of a shape as uv points; `aspect` = cloth width / height keeps it undistorted. */
export function shapePolygon(s: Shape, aspect: number): number[][] {
	const pts: number[][] = [];
	const add = (x: number, y: number) => pts.push([s.cx + x * s.r, s.cy + y * s.r * aspect]);
	if (s.kind === "circle") {
		for (let i = 0; i < 48; i++) {
			const a = (i / 48) * Math.PI * 2;
			add(Math.cos(a), Math.sin(a));
		}
	} else if (s.kind === "star") {
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
			const r = i % 2 === 0 ? 1 : 0.46;
			add(Math.cos(a) * r, Math.sin(a) * r);
		}
	} else if (s.kind === "diamond") {
		add(0, -1);
		add(0.72, 0);
		add(0, 1);
		add(-0.72, 0);
	} else if (s.kind === "shield") {
		const top: number[][] = [
			[-0.8, -0.95],
			[0.8, -0.95],
			[0.8, 0.1],
		];
		for (const [x, y] of top) add(x, y);
		for (let i = 1; i < 12; i++) {
			const t = i / 12;
			add(0.8 * Math.cos((t * Math.PI) / 2), 0.1 + 0.9 * Math.sin((t * Math.PI) / 2));
		}
		add(0, 1);
		for (let i = 11; i > 0; i--) {
			const t = i / 12;
			add(-0.8 * Math.cos((t * Math.PI) / 2), 0.1 + 0.9 * Math.sin((t * Math.PI) / 2));
		}
		add(-0.8, 0.1);
	} else {
		// heart
		for (let i = 0; i < 64; i++) {
			const t = (i / 64) * Math.PI * 2;
			const x = 16 * Math.sin(t) ** 3;
			const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
			add(x / 17, y / 17 - 0.08);
		}
	}
	return pts;
}

export function insidePolygon(poly: number[][], u: number, v: number): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i][0],
			yi = poly[i][1],
			xj = poly[j][0],
			yj = poly[j][1];
		if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

function tracePoly(ctx: CanvasRenderingContext2D, poly: number[][], W: number, H: number) {
	ctx.beginPath();
	poly.forEach(([u, v], i) => {
		if (i === 0) ctx.moveTo(u * W, v * H);
		else ctx.lineTo(u * W, v * H);
	});
	ctx.closePath();
}

export function drawPrint(spec: PrintSpec, clothW: number, clothH: number): HTMLCanvasElement {
	const aspect = clothW / clothH;
	const W = aspect >= 1 ? 1024 : Math.round(1024 * aspect);
	const H = aspect >= 1 ? Math.round(1024 / aspect) : 1024;
	const cv = document.createElement("canvas");
	cv.width = W;
	cv.height = H;
	const ctx = cv.getContext("2d");
	if (!ctx) return cv;
	const ppm = W / clothW; // pixels per metre
	ctx.fillStyle = spec.base ?? "#ffffff";
	ctx.fillRect(0, 0, W, H);

	const p = spec.pattern;
	if (p) {
		if (p.kind === "gingham") {
			const c = (p.cell ?? 0.085) * ppm;
			ctx.fillStyle = p.color;
			ctx.globalAlpha = 0.55;
			for (let x = -c / 2; x < W; x += c * 2) ctx.fillRect(x, 0, c, H);
			for (let y = -c / 2; y < H; y += c * 2) ctx.fillRect(0, y, W, c);
			ctx.globalAlpha = 1;
		} else if (p.kind === "stripes") {
			const c = (p.cell ?? 0.07) * ppm;
			ctx.fillStyle = p.color;
			if (p.horizontal) for (let y = c / 2; y < H; y += c * 2) ctx.fillRect(0, y, W, c);
			else for (let x = c / 2; x < W; x += c * 2) ctx.fillRect(x, 0, c, H);
		} else if (p.kind === "tartan") {
			const c = (p.cell ?? 0.2) * ppm;
			const band = (x: number, w: number, col: string, a: number) => {
				ctx.fillStyle = col;
				ctx.globalAlpha = a;
				for (let o = x; o < Math.max(W, H); o += c) {
					ctx.fillRect(o, 0, w, H);
					ctx.fillRect(0, o, W, w);
				}
			};
			band(0, c * 0.34, p.color, 0.5);
			band(c * 0.5, c * 0.12, p.color2, 0.55);
			band(c * 0.74, c * 0.035, "#f5e9c8", 0.6);
			band(c * 0.17, c * 0.02, "#0a0a0a", 0.5);
			ctx.globalAlpha = 1;
		} else if (p.kind === "dots") {
			const c = (p.cell ?? 0.11) * ppm;
			ctx.fillStyle = p.color;
			let row = 0;
			for (let y = c / 2; y < H + c; y += c * 0.87, row++)
				for (let x = (row % 2) * c * 0.5 + c / 2; x < W + c; x += c) {
					ctx.beginPath();
					ctx.arc(x, y, c * 0.22, 0, Math.PI * 2);
					ctx.fill();
				}
		} else if (p.kind === "bands") {
			const n = p.colors.length;
			p.colors.forEach((col, i) => {
				ctx.fillStyle = col;
				ctx.fillRect(0, Math.floor((i * H) / n), W, Math.ceil(H / n) + 1);
			});
		} else if (p.kind === "wash") {
			// stonewashed denim: paler down the middle, whiskers, streaks
			const g = ctx.createLinearGradient(0, 0, W, 0);
			g.addColorStop(0, "rgba(10,20,45,0.28)");
			g.addColorStop(0.5, "rgba(255,255,255,0.14)");
			g.addColorStop(1, "rgba(10,20,45,0.28)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);
			for (let i = 0; i < 260; i++) {
				const x = hash01(i * 3) * W;
				ctx.fillStyle = `rgba(255,255,255,${0.02 + hash01(i * 7) * 0.05})`;
				ctx.fillRect(x, hash01(i * 11) * H, 1 + hash01(i * 5) * 2, 40 + hash01(i * 13) * 260);
			}
		} else if (p.kind === "ruled") {
			ctx.strokeStyle = p.color;
			ctx.lineWidth = Math.max(1, ppm * 0.002);
			const c = 0.045 * ppm;
			ctx.globalAlpha = 0.7;
			ctx.beginPath();
			for (let y = c * 2; y < H; y += c) {
				ctx.moveTo(0, y);
				ctx.lineTo(W, y);
			}
			ctx.stroke();
			ctx.strokeStyle = "#d23a3a";
			ctx.beginPath();
			ctx.moveTo(W * 0.1, 0);
			ctx.lineTo(W * 0.1, H);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}

	if (spec.trim) {
		const h = 0.05 * ppm;
		ctx.fillStyle = spec.trim;
		ctx.fillRect(0, H - h, W, h);
		// tassels
		ctx.fillStyle = "rgba(0,0,0,0.35)";
		for (let x = 0; x < W; x += h * 0.35) ctx.fillRect(x, H - h * 0.8, h * 0.1, h * 0.8);
	}

	if (spec.emblem) {
		const e = spec.emblem;
		const poly = shapePolygon(e.shape, aspect);
		tracePoly(ctx, poly, W, H);
		ctx.fillStyle = e.fill;
		ctx.fill();
		const cx = e.shape.cx * W,
			cy = e.shape.cy * H,
			r = e.shape.r * W;
		if (e.detail) {
			// inner line that echoes the outline, like appliqué stitching
			const inner = shapePolygon({ ...e.shape, r: e.shape.r * 0.8 }, aspect);
			tracePoly(ctx, inner, W, H);
			ctx.strokeStyle = e.detail;
			ctx.lineWidth = r * 0.045;
			ctx.setLineDash([r * 0.1, r * 0.07]);
			ctx.stroke();
			ctx.setLineDash([]);
		}
		if (e.guide) {
			const outer = shapePolygon({ ...e.shape, r: e.shape.r * 1.13 }, aspect);
			tracePoly(ctx, outer, W, H);
			ctx.strokeStyle = "rgba(20,20,24,0.8)";
			ctx.lineWidth = Math.max(2, ppm * 0.006);
			ctx.setLineDash([ppm * 0.03, ppm * 0.022]);
			ctx.stroke();
			ctx.setLineDash([]);
			// little scissors mark at the top of the guide
			ctx.fillStyle = "rgba(20,20,24,0.85)";
			ctx.font = `${Math.round(r * 0.3)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.fillText("✂", cx - r * 0.02, cy - r * 1.2 * (e.shape.kind === "heart" ? 1.0 : 1.18));
		}
	}

	if (spec.text) {
		const t = spec.text;
		const px = t.size * W;
		ctx.font = `${Math.round(px)}px Anton, Impact, "Arial Narrow", sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = t.color;
		const y = t.cy * H;
		ctx.fillText(t.str, W / 2, y);
		if (t.sub) {
			ctx.font = `600 ${Math.round(px * 0.17)}px "Outfit Variable", system-ui, sans-serif`;
			const sp = px * 0.045;
			// letterspaced caption
			const chars = t.sub.split("");
			const widths = chars.map((c) => ctx.measureText(c).width + sp);
			const total = widths.reduce((a, b) => a + b, 0);
			let x = W / 2 - total / 2;
			ctx.textAlign = "left";
			chars.forEach((c, i) => {
				ctx.fillText(c, x, y + px * 0.68);
				x += widths[i];
			});
		}
		if (t.stencil) {
			// stencil bridges: thin gaps cut through the letters
			ctx.fillStyle = spec.base ?? "#ffffff";
			for (let i = -4; i <= 4; i++)
				ctx.fillRect(W / 2 + i * px * 0.47 - px * 0.012, y - px, px * 0.024, px * 2);
		}
	}

	if (spec.hem) {
		const inset = 0.022 * ppm;
		// the folded hem is a double layer: a touch darker
		ctx.fillStyle = "rgba(0,0,0,0.07)";
		ctx.fillRect(0, 0, W, inset * 1.3);
		ctx.fillRect(0, H - inset * 1.3, W, inset * 1.3);
		ctx.fillRect(0, 0, inset * 1.3, H);
		ctx.fillRect(W - inset * 1.3, 0, inset * 1.3, H);
		ctx.strokeStyle = spec.hem;
		ctx.lineWidth = Math.max(1.5, ppm * 0.0035);
		ctx.setLineDash([ppm * 0.011, ppm * 0.008]);
		ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
		ctx.setLineDash([]);
	}

	if (spec.age) {
		const n = Math.round(26 * spec.age);
		for (let i = 0; i < n; i++) {
			const x = hash01(i * 17 + 1) * W,
				y = hash01(i * 29 + 2) * H,
				r = (0.05 + hash01(i * 31 + 3) * 0.2) * W;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			const a = 0.05 + hash01(i * 37) * 0.1 * spec.age;
			g.addColorStop(0, `rgba(70,50,25,${a})`);
			g.addColorStop(1, "rgba(70,50,25,0)");
			ctx.fillStyle = g;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
		}
	}
	return cv;
}
