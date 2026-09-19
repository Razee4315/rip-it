import { OVERFLOW_TOOLS, PRIMARY_TOOLS, type ToolId } from "@/sim/tools";
import { tokens } from "@/theme/tokens";
import styled from "styled-components";
import { IconMore, toolIcon } from "./icons";

const Dock = styled.nav`
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: ${tokens.zIndex.dock};
	display: flex;
	justify-content: center;
	gap: 6px;
	padding: 8px 12px;
	padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
	padding-left: max(12px, env(safe-area-inset-left, 0px));
	padding-right: max(12px, env(safe-area-inset-right, 0px));
	background: linear-gradient(180deg, transparent, rgba(8, 9, 12, 0.85) 40%);
	pointer-events: none;
`;

const Row = styled.div`
	pointer-events: auto;
	display: flex;
	gap: 6px;
	align-items: center;
	background: ${tokens.colors.surface.elevated};
	border: 1px solid ${tokens.colors.border.default};
	border-radius: 14px;
	padding: 6px;
	box-shadow: ${tokens.shadows.card};
`;

const Btn = styled.button<{ $active?: boolean }>`
	min-width: 48px;
	min-height: 48px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	border-radius: 12px;
	border: 2.5px solid
		${({ $active }) => ($active ? tokens.colors.primary : "transparent")};
	background: ${({ $active }) => ($active ? tokens.colors.surface.overlayActive : "transparent")};
	color: ${({ $active }) => ($active ? tokens.colors.primary : tokens.colors.text.primary)};
	box-shadow: ${({ $active }) => ($active ? tokens.shadows.glow.primary : "none")};
	cursor: pointer;
	font: inherit;
	font-size: 10px;
	font-weight: ${({ $active }) => ($active ? 700 : 500)};
	white-space: nowrap;
	box-sizing: border-box;

	svg {
		color: inherit;
	}

	&:active {
		transform: scale(0.96);
	}
`;

type Props = {
	tool: ToolId;
	onTool: (id: ToolId) => void;
	onOverflow: () => void;
	overflowOpen: boolean;
};

export function ToolDock({ tool, onTool, onOverflow, overflowOpen }: Props) {
	const overflowActive = OVERFLOW_TOOLS.some((t) => t.id === tool);
	return (
		<Dock aria-label="Tools">
			<Row>
				{PRIMARY_TOOLS.map((t) => (
					<Btn
						key={t.id}
						type="button"
						$active={tool === t.id}
						aria-label={t.name}
						aria-pressed={tool === t.id}
						onClick={() => onTool(t.id)}
					>
						{toolIcon(t.id, 26)}
						<span>{t.name}</span>
					</Btn>
				))}
				<Btn
					type="button"
					$active={overflowOpen || overflowActive}
					aria-label="More tools"
					aria-pressed={overflowOpen}
					onClick={onOverflow}
				>
					<IconMore size={26} />
					<span>More</span>
				</Btn>
			</Row>
		</Dock>
	);
}
