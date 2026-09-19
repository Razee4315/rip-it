import { MATERIALS } from "@/sim/materials";
import { OVERFLOW_TOOLS, type ToolId } from "@/sim/tools";
import { tokens } from "@/theme/tokens";
import styled from "styled-components";
import { IconRefresh, IconSlow, IconSpeaker, IconSpeakerOff, toolIcon } from "./icons";

const Backdrop = styled.div`
	position: absolute;
	inset: 0;
	z-index: ${tokens.zIndex.sheet};
	background: ${tokens.colors.overlay};
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding-top: env(safe-area-inset-top, 0px);
`;

const Panel = styled.div`
	width: min(480px, 100%);
	max-height: min(78dvh, 640px);
	overflow-y: auto;
	background: ${tokens.colors.background.dark};
	border: 1px solid ${tokens.colors.border.default};
	border-radius: 16px 16px 0 0;
	padding: 16px 16px max(20px, env(safe-area-inset-bottom, 0px));
`;

const Title = styled.h2`
	margin: 0 0 12px;
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 1.4px;
	color: ${tokens.colors.text.secondary};
`;

const Chips = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 6px;
	margin-bottom: 16px;
`;

const Chip = styled.button<{ $sel?: boolean }>`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px;
	text-align: left;
	border-radius: 9px;
	border: 1px solid
		${({ $sel }) => ($sel ? tokens.colors.primary : tokens.colors.border.default)};
	background: ${({ $sel }) =>
		$sel ? tokens.colors.surface.overlayActive : tokens.colors.surface.overlay};
	color: ${tokens.colors.text.primary};
	cursor: pointer;
	font: inherit;
	min-height: 44px;

	i {
		width: 26px;
		height: 26px;
		min-width: 26px;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.4);
	}
	b {
		display: block;
		font-size: 12.5px;
	}
	small {
		color: ${tokens.colors.text.secondary};
		font-size: 10px;
	}
`;

const Slider = styled.label`
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 8px 0;
	font-size: 12px;
	color: ${tokens.colors.text.secondary};
	span {
		min-width: 64px;
	}
	input {
		flex: 1;
		accent-color: ${tokens.colors.primary};
	}
`;

const Tools = styled.div`
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 6px;
	margin-bottom: 16px;
`;

const ToolBtn = styled.button<{ $sel?: boolean }>`
	min-height: 56px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	border-radius: 9px;
	border: 1px solid
		${({ $sel }) => ($sel ? tokens.colors.primary : tokens.colors.border.default)};
	background: ${({ $sel }) =>
		$sel ? tokens.colors.surface.overlayActive : tokens.colors.surface.overlay};
	color: ${({ $sel }) => ($sel ? tokens.colors.primary : tokens.colors.text.primary)};
	cursor: pointer;
	font: inherit;
	font-size: 11px;
`;

const Row = styled.div`
	display: flex;
	gap: 6px;
	margin-top: 8px;
`;

const Btn = styled.button<{ $on?: boolean }>`
	flex: 1;
	min-width: ${tokens.touch.minTargetPx}px;
	min-height: ${tokens.touch.minTargetPx}px;
	padding: 10px 8px;
	border-radius: 8px;
	border: 1px solid
		${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.border.default)};
	background: ${({ $on }) =>
		$on ? tokens.colors.surface.overlayActive : tokens.colors.surface.overlay};
	color: ${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.text.primary)};
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	white-space: nowrap;
	box-sizing: border-box;
`;

/** Icon+label mute — never shrink below AC-11 44×44 */
const MuteBtn = styled(Btn)`
	flex: 0 0 auto;
	min-width: ${tokens.touch.minTargetPx}px;
	min-height: ${tokens.touch.minTargetPx}px;
	padding: 10px 12px;
`;

const StatGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 8px;
	margin: 4px 0 14px;
`;

const Stat = styled.div`
	padding: 10px 8px;
	border-radius: 9px;
	border: 1px solid ${tokens.colors.border.default};
	background: ${tokens.colors.surface.overlay};
	text-align: center;
	small {
		display: block;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: ${tokens.colors.text.secondary};
		margin-bottom: 4px;
	}
	b {
		font-size: 16px;
		font-weight: 700;
		color: ${tokens.colors.text.primary};
	}
`;

const DestroyBar = styled.div`
	height: 8px;
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.07);
	overflow: hidden;
	margin-bottom: 12px;
	i {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: linear-gradient(90deg, ${tokens.colors.primary}, ${tokens.colors.secondary});
	}
`;

type Props = {
	mode: "world" | "overflow";
	matId: string;
	tool: ToolId;
	wind: number;
	gravity: number;
	slowmo: boolean;
	muted: boolean;
	destroyed: number;
	pieces: number;
	fibers: number;
	onClose: () => void;
	onMat: (id: string) => void;
	onTool: (id: ToolId) => void;
	onWind: (v: number) => void;
	onGravity: (v: number) => void;
	onSlowmo: () => void;
	onMute: () => void;
	onFresh: () => void;
};

export function Sheet(props: Props) {
	return (
		<Backdrop onClick={props.onClose} role="presentation">
			<Panel
				onClick={(e) => e.stopPropagation()}
				aria-label={props.mode === "world" ? "Fabric and world" : "More tools"}
			>
				{props.mode === "overflow" ? (
					<>
						<Title>More tools</Title>
						<Tools>
							{OVERFLOW_TOOLS.map((t) => (
								<ToolBtn
									key={t.id}
									type="button"
									$sel={props.tool === t.id}
									onClick={() => {
										props.onTool(t.id);
										props.onClose();
									}}
								>
									{toolIcon(t.id, 22)}
									{t.name}
								</ToolBtn>
							))}
						</Tools>
					</>
				) : (
					<>
						<Title>Fabric</Title>
						<Chips>
							{MATERIALS.map((m) => (
								<Chip
									key={m.id}
									type="button"
									$sel={props.matId === m.id}
									onClick={() => {
										props.onMat(m.id);
										props.onClose();
									}}
								>
									<i style={{ background: m.swatch }} />
									<span>
										<b>{m.name}</b>
										<small>{m.desc}</small>
									</span>
								</Chip>
							))}
						</Chips>
						<Title>World</Title>
						<Slider>
							<span>Wind</span>
							<input
								type="range"
								min={0}
								max={100}
								value={Math.round(props.wind * 100)}
								onChange={(e) => props.onWind(Number(e.target.value) / 100)}
							/>
						</Slider>
						<Slider>
							<span>Gravity</span>
							<input
								type="range"
								min={0}
								max={150}
								value={Math.round(props.gravity * 100)}
								onChange={(e) => props.onGravity(Number(e.target.value) / 100)}
							/>
						</Slider>
						<Row>
							<Btn type="button" $on={props.slowmo} onClick={props.onSlowmo}>
								<IconSlow size={16} /> Slow-mo
							</Btn>
							<MuteBtn
								type="button"
								$on={props.muted}
								onClick={props.onMute}
								aria-label={props.muted ? "Unmute" : "Mute"}
							>
								{props.muted ? <IconSpeakerOff size={18} /> : <IconSpeaker size={18} />}
								{props.muted ? "Unmute" : "Mute"}
							</MuteBtn>
						</Row>
						<Title>Destruction</Title>
						<DestroyBar aria-hidden="true">
							<i style={{ width: `${Math.min(100, Math.round(props.destroyed * 100))}%` }} />
						</DestroyBar>
						<StatGrid>
							<Stat>
								<small>Destroyed</small>
								<b>{Math.round(props.destroyed * 100)}%</b>
							</Stat>
							<Stat>
								<small>Pieces</small>
								<b>{props.pieces}</b>
							</Stat>
							<Stat>
								<small>Fibres</small>
								<b>{props.fibers}</b>
							</Stat>
						</StatGrid>
						<Row>
							<Btn
								type="button"
								onClick={() => {
									props.onFresh();
									props.onClose();
								}}
							>
								<IconRefresh size={16} /> Fresh cloth
							</Btn>
						</Row>
					</>
				)}
			</Panel>
		</Backdrop>
	);
}
