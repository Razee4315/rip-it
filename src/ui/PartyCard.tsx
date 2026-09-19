import { tokens } from "@/theme/tokens";
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

const Sub = styled.div`
	color: ${tokens.colors.text.secondary};
	font-size: 14px;
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

type Props = { onFresh: () => void };

export function PartyCard({ onFresh }: Props) {
	return (
		<Overlay>
			<Card>
				<Big>
					<IconParty size={22} />
					TOTALLY SHREDDED!
					<IconParty size={22} />
				</Big>
				<Sub>Nothing left but scraps. Respect.</Sub>
				<Cta type="button" onClick={onFresh}>
					<IconRefresh size={16} />
					Fresh cloth
				</Cta>
			</Card>
		</Overlay>
	);
}
