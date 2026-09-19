import { tokens } from "@/theme/tokens";
import { keyframes } from "styled-components";
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
	background: linear-gradient(180deg, rgba(8, 9, 12, 0.55), transparent);
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

const tipPulse = keyframes`
	0%, 100% { transform: translateX(-50%) scale(1); box-shadow: ${tokens.shadows.glow.primary}; }
	50% { transform: translateX(-50%) scale(1.045); box-shadow: ${tokens.shadows.glow.primary}, 0 0 22px rgba(232, 161, 58, 0.35); }
`;

const Tip = styled.button`
	position: absolute;
	left: 50%;
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
	animation: ${tipPulse} 2.2s ease-in-out infinite;
`;

const toastIn = keyframes`
	from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
	to { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

const Toast = styled.div`
	position: absolute;
	left: 50%;
	top: max(60px, calc(env(safe-area-inset-top, 0px) + 52px));
	transform: translateX(-50%);
	z-index: ${tokens.zIndex.toast};
	min-height: 36px;
	padding: 8px 14px;
	border-radius: 999px;
	background: rgba(22, 26, 34, 0.92);
	border: 1px solid ${tokens.colors.border.default};
	color: ${tokens.colors.text.secondary};
	font: inherit;
	font-size: 12.5px;
	font-weight: 500;
	letter-spacing: 0.2px;
	pointer-events: none;
	white-space: nowrap;
	max-width: calc(100% - 24px);
	overflow: hidden;
	text-overflow: ellipsis;
	animation: ${toastIn} 0.22s ease-out;
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
	tip: string | null;
	toast: string | null;
	onOpenWorld: () => void;
	onDismissTip: () => void;
};

/** Play chrome only — stats live in World sheet (fun pass). */
export function Hud({ tip, toast, onOpenWorld, onDismissTip }: Props) {
	return (
		<>
			<Top>
				<Brand>
					<IconLogo size={20} />
					RIP<span>IT!</span>
				</Brand>
				<Gear type="button" aria-label="Fabric and world settings" onClick={onOpenWorld}>
					<IconSliders size={20} />
				</Gear>
			</Top>
			{tip && (
				<Tip type="button" role="status" onClick={onDismissTip} aria-label={tip}>
					{tip}
				</Tip>
			)}
			{toast && (
				<Toast role="status" aria-live="polite">
					{toast}
				</Toast>
			)}
			<Legend>1–8 tools · R fresh cloth · S slow-mo · M mute</Legend>
		</>
	);
}
