import type { PartyPayload } from "@/sim/types";
import { tokens } from "@/theme/tokens";
import { type MutableRefObject, useEffect, useRef } from "react";
import styled from "styled-components";
import { IconParty, IconRefresh } from "./icons";

const Overlay = styled.div`
	position: absolute;
	inset: 0;
	z-index: ${tokens.zIndex.modal};
	display: flex;
	align-items: flex-start;
	justify-content: center;
	padding: max(24px, env(safe-area-inset-top, 0px)) 16px
		max(24px, env(safe-area-inset-bottom, 0px));
	background: ${tokens.colors.overlay};
	backdrop-filter: blur(2px);
`;

const ConfettiCanvas = styled.canvas`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
`;

const Card = styled.div`
	margin: auto;
	background: ${tokens.colors.background.light};
	border: 1px solid rgba(232, 161, 58, 0.35);
	border-radius: 14px;
	padding: 28px 32px;
	text-align: center;
	box-shadow: ${tokens.shadows.card}, ${tokens.shadows.glow.primary};
	max-width: 360px;
`;

const Big = styled.div`
	font-size: 22px;
	font-weight: 800;
	letter-spacing: 0.4px;
	margin-bottom: 8px;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	color: ${tokens.colors.text.primary};

	svg {
		color: ${tokens.colors.primary};
	}
`;

const Recap = styled.div`
	display: flex;
	justify-content: center;
	gap: 18px;
	margin: 12px 0 4px;

	b {
		display: block;
		font-size: 20px;
		font-weight: 800;
		color: ${tokens.colors.primary};
		letter-spacing: 0.3px;
	}

	span {
		display: block;
		margin-top: 2px;
		font-size: 11px;
		color: ${tokens.colors.text.secondary};
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}
`;

const Sub = styled.div`
	color: ${tokens.colors.text.secondary};
	font-size: 14px;
	margin-top: 8px;
`;

const Cta = styled.button`
	margin-top: 14px;
	padding: 10px 22px;
	min-height: 44px;
	font-size: 14px;
	background: ${tokens.colors.primary};
	border: none;
	border-radius: 8px;
	color: #1a1206;
	font-weight: 700;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	white-space: nowrap;
`;

const CONFETTI_COLORS = ["#e8a13a", "#e2554f", "#5fb37a", "#5b8ee6", "#e8d15a", "#c96fd9"];

type Piece = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	w: number;
	h: number;
	rot: number;
	vr: number;
	c: string;
};

/** One-shot confetti burst from screen center, self-stopping after ~3s. */
function Confetti({ canvasRef }: { canvasRef: MutableRefObject<HTMLCanvasElement | null> }) {
	useEffect(() => {
		const cv = canvasRef.current;
		if (!cv) return;
		const ctx = cv.getContext("2d");
		if (!ctx) return;
		const DPR = Math.min(2, window.devicePixelRatio || 1);
		const W = cv.clientWidth || 360;
		const H = cv.clientHeight || 640;
		cv.width = Math.round(W * DPR);
		cv.height = Math.round(H * DPR);
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		const pieces: Piece[] = Array.from({ length: 150 }, () => ({
			x: W / 2 + (Math.random() - 0.5) * 60,
			y: H / 2,
			vx: (Math.random() - 0.5) * 620,
			vy: -160 - Math.random() * 460,
			w: 4 + Math.random() * 5,
			h: 3 + Math.random() * 4,
			rot: Math.random() * Math.PI,
			vr: (Math.random() - 0.5) * 14,
			c: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
		}));
		let raf = 0;
		let lastT = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			const t = (now - t0) / 1000;
			const dt = Math.min(0.05, t - lastT) || 1 / 60;
			lastT = t;
			ctx.clearRect(0, 0, W, H);
			let alive = 0;
			for (const p of pieces) {
				p.vy += 980 * dt;
				p.vx *= 1 - dt * 0.6;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.rot += p.vr * dt;
				if (p.y < H + 20) alive++;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.globalAlpha = clamp(1.6 - t / 2.5, 0, 1);
				ctx.fillStyle = p.c;
				ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
				ctx.restore();
			}
			if (alive > 0 && t < 3.2) raf = requestAnimationFrame(tick);
			else ctx.clearRect(0, 0, W, H);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [canvasRef]);
	return <ConfettiCanvas ref={canvasRef} />;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function hypeLine(fibers: number) {
	if (fibers >= 1200) return "Certified fabric destroyer.";
	if (fibers >= 400) return "Deeply satisfying. Admit it.";
	return "Nothing left but scraps. Respect.";
}

function fmtTime(s: number) {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

type Props = { stats: PartyPayload | null; onFresh: () => void };

export function PartyCard({ stats, onFresh }: Props) {
	const confettiRef = useRef<HTMLCanvasElement | null>(null);
	return (
		<Overlay>
			<Confetti canvasRef={confettiRef} />
			<Card>
				<Big>
					<IconParty size={22} />
					TOTALLY SHREDDED!
					<IconParty size={22} />
				</Big>
				<Recap>
					<div>
						<b>{stats ? stats.fibers.toLocaleString() : "—"}</b>
						<span>fibres</span>
					</div>
					<div>
						<b>{stats ? stats.pieces : "—"}</b>
						<span>pieces</span>
					</div>
					<div>
						<b>{stats ? fmtTime(stats.seconds) : "—"}</b>
						<span>time</span>
					</div>
				</Recap>
				<Sub>{hypeLine(stats?.fibers ?? 0)}</Sub>
				<Cta type="button" onClick={onFresh}>
					<IconRefresh size={16} />
					Fresh cloth
				</Cta>
			</Card>
		</Overlay>
	);
}
