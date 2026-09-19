import { tokens } from "@/theme/tokens";
import styled from "styled-components";
import { IconLogo, IconSliders } from "./icons";

const Top = styled.header`
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	z-index: ${tokens.zIndex.dock};
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
		8px max(12px, env(safe-area-inset-left, 0px));
	pointer-events: none;
	background: linear-gradient(180deg, rgba(8, 9, 12, 0.75), transparent);
`;

const Brand = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	color: #fff;
	font-weight: 800;
	font-size: 18px;
	letter-spacing: 0.6px;
	pointer-events: none;

	span {
		color: ${tokens.colors.primary};
	}
	svg {
		color: ${tokens.colors.primary};
	}
`;

const Stats = styled.div`
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 6px 10px;
	font-size: 11px;
	color: ${tokens.colors.text.secondary};
	pointer-events: none;
	max-width: min(420px, 52vw);

	b {
		color: ${tokens.colors.text.primary};
		font-weight: 600;
	}
`;

const Gear = styled.button`
	pointer-events: auto;
	min-width: 44px;
	min-height: 44px;
	border-radius: 10px;
	border: 1px solid ${tokens.colors.border.default};
	background: ${tokens.colors.surface.elevated};
	color: ${tokens.colors.text.primary};
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
`;

const Tip = styled.button`
	position: absolute;
	left: 50%;
	/* UX §4: lower-center of canvas, clear of dock + safe-area */
	bottom: max(88px, calc(env(safe-area-inset-bottom, 0px) + 72px));
	top: auto;
	transform: translateX(-50%);
	z-index: ${tokens.zIndex.toast};
	min-height: ${tokens.touch.minTargetPx}px;
	padding: 10px 16px;
	border-radius: 999px;
	background: rgba(22, 26, 34, 0.95);
	border: 1px solid ${tokens.colors.border.party};
	box-shadow: ${tokens.shadows.glow.primary};
	color: ${tokens.colors.text.primary};
	font: inherit;
	font-size: 13px;
	font-weight: 600;
	letter-spacing: 0.2px;
	cursor: pointer;
	pointer-events: auto;
	white-space: nowrap;
`;

const Legend = styled.div`
	position: absolute;
	left: 12px;
	bottom: 72px;
	font-size: 10.5px;
	color: #5c6371;
	pointer-events: none;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);

	html.touch & {
		display: none;
	}
`;

type Props = {
	destroyed: number;
	pieces: number;
	fibers: number;
	fps: number;
	showTip: boolean;
	onOpenWorld: () => void;
	onDismissTip: () => void;
};

export function Hud({ destroyed, pieces, fibers, fps, showTip, onOpenWorld, onDismissTip }: Props) {
	return (
		<>
			<Top>
				<Brand>
					<IconLogo size={20} />
					RIP<span>IT!</span>
				</Brand>
				<Stats>
					<span>
						Destroyed <b>{Math.round(destroyed * 100)}%</b>
					</span>
					<span>
						Pieces <b>{pieces}</b>
					</span>
					<span>
						Fibres <b>{fibers}</b>
					</span>
					<span>
						FPS <b>{fps || "–"}</b>
					</span>
				</Stats>
				<Gear type="button" aria-label="Fabric and world settings" onClick={onOpenWorld}>
					<IconSliders size={20} />
				</Gear>
			</Top>
			{showTip && (
				<Tip type="button" role="status" onClick={onDismissTip} aria-label="Pinch and pull">
					Pinch and pull
				</Tip>
			)}
			<Legend>1–8 tools · R fresh cloth · S slow-mo · M mute</Legend>
		</>
	);
}
