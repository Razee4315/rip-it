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
	onOpenWorld: () => void;
};

/** Play chrome only — brand + settings. Stats live in World sheet. */
export function Hud({ onOpenWorld }: Props) {
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
			<Legend>1–8 tools · R fresh cloth · S slow-mo · M mute</Legend>
		</>
	);
}
