/** Paintings hidden behind the cloth in "reveal" levels — painted in code, like everything else. */
import { hash01 } from "../math";

export type ArtKind = "sunset" | "night" | "wave";

function ridge(x: number, seed: number, rough: number) {
	return (
		Math.sin(x * 3.1 + seed) * 0.5 +
		Math.sin(x * 7.3 + seed * 2.1) * 0.25 * rough +
		Math.sin(x * 17.7 + seed * 3.7) * 0.12 * rough +
		Math.sin(x * 41 + seed * 5.3) * 0.05 * rough
	);
}

export function paintArt(kind: ArtKind, aspect: number): HTMLCanvasElement {
	const W = 720,
		H = Math.round(720 / aspect);
	const cv = document.createElement("canvas");
	cv.width = W;
	cv.height = H;
	const c = cv.getContext("2d");
	if (!c) return cv;

	if (kind === "sunset") {
		const hz = H * 0.62;
		const sky = c.createLinearGradient(0, 0, 0, hz);
		sky.addColorStop(0, "#2a1a5e");
		sky.addColorStop(0.45, "#b0397a");
		sky.addColorStop(0.8, "#ff8a3c");
		sky.addColorStop(1, "#ffd76a");
		c.fillStyle = sky;
		c.fillRect(0, 0, W, hz);
		// sun
		const sx = W * 0.6,
			sy = hz - H * 0.07;
		const glow = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.5);
		glow.addColorStop(0, "rgba(255,250,210,1)");
		glow.addColorStop(0.12, "rgba(255,225,130,0.85)");
		glow.addColorStop(1, "rgba(255,160,60,0)");
		c.fillStyle = glow;
		c.fillRect(0, 0, W, hz);
		c.fillStyle = "#fff6d0";
		c.beginPath();
		c.arc(sx, sy, H * 0.075, 0, Math.PI * 2);
		c.fill();
		// clouds
		for (let i = 0; i < 9; i++) {
			const y = H * (0.1 + hash01(i * 7) * 0.32);
			const x = hash01(i * 13) * W;
			const w = W * (0.15 + hash01(i * 3) * 0.3);
			const g = c.createLinearGradient(0, y - 6, 0, y + 6);
			g.addColorStop(0, "rgba(255,190,150,0.55)");
			g.addColorStop(1, "rgba(120,50,110,0.4)");
			c.fillStyle = g;
			c.beginPath();
			c.ellipse(x, y, w, 5 + hash01(i) * 6, 0, 0, Math.PI * 2);
			c.fill();
		}
		// mountain ranges, nearer = darker
		const layers = [
			{ y: 0.5, amp: 0.13, col: "#7b3f86", seed: 1, rough: 1 },
			{ y: 0.56, amp: 0.1, col: "#4a2a66", seed: 5, rough: 1.3 },
			{ y: 0.61, amp: 0.06, col: "#24163f", seed: 9, rough: 1.6 },
		];
		for (const l of layers) {
			c.fillStyle = l.col;
			c.beginPath();
			c.moveTo(0, hz);
			for (let x = 0; x <= W; x += 4)
				c.lineTo(x, H * l.y - (ridge(x / W, l.seed, l.rough) * 0.5 + 0.5) * H * l.amp);
			c.lineTo(W, hz);
			c.fill();
		}
		// lake: the sky upside down, broken by ripples
		const lake = c.createLinearGradient(0, hz, 0, H);
		lake.addColorStop(0, "#ffb65a");
		lake.addColorStop(0.3, "#c0457a");
		lake.addColorStop(1, "#1d1347");
		c.fillStyle = lake;
		c.fillRect(0, hz, W, H - hz);
		for (let i = 0; i < 70; i++) {
			const y = hz + hash01(i * 5) ** 1.5 * (H - hz);
			const w = 10 + hash01(i * 3) * 70 * ((y - hz) / (H - hz) + 0.2);
			const x = sx + (hash01(i * 11) - 0.5) * W * 0.5 * ((y - hz) / (H - hz) + 0.15);
			c.fillStyle = `rgba(255,235,170,${0.25 + hash01(i) * 0.4})`;
			c.fillRect(x - w / 2, y, w, 2);
		}
		// pines on the near shore
		c.fillStyle = "#0d0a1e";
		for (let i = 0; i < 9; i++) {
			const x = (i < 5 ? 0.02 + i * 0.045 : 0.8 + (i - 5) * 0.05) * W;
			const h = H * (0.2 + hash01(i * 17) * 0.16);
			const base = H * 0.98;
			c.beginPath();
			c.moveTo(x, base - h);
			for (let k = 0; k < 6; k++) {
				const yy = base - h + ((k + 1) / 6) * h;
				const ww = ((k + 1) / 6) * h * 0.2;
				c.lineTo(x + ww, yy);
				c.lineTo(x + ww * 0.4, yy);
			}
			for (let k = 5; k >= 0; k--) {
				const yy = base - h + ((k + 1) / 6) * h;
				const ww = ((k + 1) / 6) * h * 0.2;
				c.lineTo(x - ww * 0.4, yy);
				c.lineTo(x - ww, yy);
			}
			c.fill();
		}
		c.fillRect(0, H * 0.965, W, H * 0.035);
	} else if (kind === "night") {
		const sky = c.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#081238");
		sky.addColorStop(0.6, "#1b3b8c");
		sky.addColorStop(1, "#3f6fc0");
		c.fillStyle = sky;
		c.fillRect(0, 0, W, H);
		// swirling brushwork
		c.lineCap = "round";
		for (let i = 0; i < 900; i++) {
			const x = hash01(i * 3) * W,
				y = hash01(i * 7) * H * 0.75;
			const a = Math.sin(x * 0.011 + y * 0.006) * 2.2 + Math.cos(y * 0.017 - x * 0.004) * 1.4;
			const l = 8 + hash01(i * 11) * 14;
			const tone = hash01(i * 13);
			c.strokeStyle =
				tone > 0.8
					? `rgba(250,225,120,${0.25 + tone * 0.3})`
					: `rgba(${90 + tone * 120},${140 + tone * 90},255,${0.18 + tone * 0.25})`;
			c.lineWidth = 2 + hash01(i * 17) * 3;
			c.beginPath();
			c.moveTo(x, y);
			c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
			c.stroke();
		}
		// stars with halos
		for (let i = 0; i < 11; i++) {
			const x = (0.06 + hash01(i * 19) * 0.88) * W,
				y = (0.06 + hash01(i * 23) * 0.5) * H;
			const r = 10 + hash01(i * 29) * 22;
			const g = c.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, "rgba(255,250,210,1)");
			g.addColorStop(0.25, "rgba(255,225,110,0.75)");
			g.addColorStop(1, "rgba(255,210,90,0)");
			c.fillStyle = g;
			c.fillRect(x - r, y - r, r * 2, r * 2);
		}
		// crescent moon
		c.fillStyle = "#ffe9a0";
		c.beginPath();
		c.arc(W * 0.84, H * 0.17, H * 0.085, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#16307a";
		c.beginPath();
		c.arc(W * 0.815, H * 0.155, H * 0.07, 0, Math.PI * 2);
		c.fill();
		// hills and a sleeping town
		c.fillStyle = "#0c1a45";
		c.beginPath();
		c.moveTo(0, H);
		for (let x = 0; x <= W; x += 4)
			c.lineTo(x, H * 0.74 - (ridge(x / W, 3, 1) * 0.5 + 0.5) * H * 0.1);
		c.lineTo(W, H);
		c.fill();
		for (let i = 0; i < 16; i++) {
			const x = (0.25 + i * 0.045) * W,
				w = W * 0.036,
				h = H * (0.06 + hash01(i * 31) * 0.07);
			c.fillStyle = "#081030";
			c.fillRect(x, H * 0.88 - h, w, h + H * 0.12);
			c.beginPath();
			c.moveTo(x - 2, H * 0.88 - h);
			c.lineTo(x + w / 2, H * 0.88 - h - w * 0.6);
			c.lineTo(x + w + 2, H * 0.88 - h);
			c.fill();
			if (hash01(i * 37) > 0.35) {
				c.fillStyle = "#ffd15a";
				c.fillRect(x + w * 0.3, H * 0.88 - h * 0.6, w * 0.3, w * 0.34);
			}
		}
		// a cypress, dark against it all
		c.fillStyle = "#050a1c";
		c.beginPath();
		c.moveTo(W * 0.1, H);
		c.bezierCurveTo(W * 0.04, H * 0.7, W * 0.13, H * 0.5, W * 0.12, H * 0.22);
		c.bezierCurveTo(W * 0.16, H * 0.5, W * 0.21, H * 0.75, W * 0.18, H);
		c.fill();
	} else {
		// a great breaking wave
		const sky = c.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#f3e6c8");
		sky.addColorStop(1, "#e5cfa2");
		c.fillStyle = sky;
		c.fillRect(0, 0, W, H);
		c.fillStyle = "#d8452e";
		c.beginPath();
		c.arc(W * 0.72, H * 0.3, H * 0.13, 0, Math.PI * 2);
		c.fill();
		// far swell
		c.fillStyle = "#3b7f9c";
		c.beginPath();
		c.moveTo(0, H);
		for (let x = 0; x <= W; x += 4) c.lineTo(x, H * 0.72 + Math.sin(x * 0.02) * H * 0.03);
		c.lineTo(W, H);
		c.fill();
		// the wave body
		const body = c.createLinearGradient(0, H * 0.2, 0, H);
		body.addColorStop(0, "#1f5e86");
		body.addColorStop(1, "#0d2b4f");
		c.fillStyle = body;
		c.beginPath();
		c.moveTo(0, H);
		c.lineTo(0, H * 0.55);
		c.bezierCurveTo(W * 0.1, H * 0.2, W * 0.34, H * 0.06, W * 0.5, H * 0.2);
		c.bezierCurveTo(W * 0.58, H * 0.28, W * 0.56, H * 0.42, W * 0.46, H * 0.44);
		c.bezierCurveTo(W * 0.5, H * 0.36, W * 0.44, H * 0.3, W * 0.36, H * 0.34);
		c.bezierCurveTo(W * 0.26, H * 0.4, W * 0.3, H * 0.7, W * 0.52, H * 0.8);
		c.bezierCurveTo(W * 0.7, H * 0.86, W * 0.9, H * 0.78, W, H * 0.82);
		c.lineTo(W, H);
		c.fill();
		// ribs of the swell
		c.strokeStyle = "rgba(190,225,235,0.35)";
		c.lineWidth = 3;
		for (let i = 0; i < 7; i++) {
			c.beginPath();
			c.moveTo(W * 0.02, H * (0.6 + i * 0.05));
			c.bezierCurveTo(
				W * 0.14,
				H * (0.34 + i * 0.05),
				W * 0.3,
				H * (0.2 + i * 0.045),
				W * 0.42,
				H * (0.22 + i * 0.03),
			);
			c.stroke();
		}
		// foam claws along the crest
		c.fillStyle = "#fbf6ea";
		for (let i = 0; i < 46; i++) {
			const t = i / 45;
			const x = W * (0.03 + t * 0.52);
			const y = H * (0.5 - Math.sin(t * Math.PI * 0.95) * 0.36) + (hash01(i * 3) - 0.5) * H * 0.04;
			c.beginPath();
			c.arc(x, y, H * (0.016 + hash01(i * 7) * 0.022), 0, Math.PI * 2);
			c.fill();
			if (i % 3 === 0 && t > 0.5) {
				c.beginPath();
				c.arc(x + W * 0.03, y + H * 0.06, H * 0.012, 0, Math.PI * 2);
				c.fill();
			}
		}
		for (let i = 0; i < 60; i++) {
			c.beginPath();
			c.arc(
				W * (0.45 + hash01(i * 5) * 0.3),
				H * (0.1 + hash01(i * 9) * 0.45),
				1.5 + hash01(i) * 3,
				0,
				Math.PI * 2,
			);
			c.fill();
		}
	}
	// canvas tooth and a hint of varnish
	for (let i = 0; i < 2600; i++) {
		c.fillStyle = `rgba(${hash01(i) > 0.5 ? 255 : 0},${hash01(i) > 0.5 ? 255 : 0},${hash01(i) > 0.5 ? 255 : 0},0.035)`;
		c.fillRect(hash01(i * 3) * W, hash01(i * 7) * H, 2, 2);
	}
	return cv;
}
