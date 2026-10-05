import { FABRICS } from "@/engine/cloth/fabrics";
import type { HudState, LevelDef } from "@/game/types";
import { IconClock, IconPause, IconRestart, IconShield, IconSliders, ObjectiveIcon } from "./icons";

type Props = {
	level: LevelDef;
	hud: HudState;
	onPause: () => void;
	onRestart: () => void;
	onSheet?: () => void;
};

/** Top bar while playing: pause, what to do and how far along, and the clock. */
export function Hud({ level, hud, onPause, onRestart, onSheet }: Props) {
	const sandbox = level.objective.type === "sandbox";
	const done = hud.progress >= 1 && !sandbox;
	const low = hud.timeLeft !== null && hud.timeLeft <= 5 && hud.started;
	return (
		<header className="hud">
			<button type="button" className="round" aria-label="Pause" onClick={onPause}>
				<IconPause size={22} />
			</button>
			<div className="goalwrap">
				<div className={`goal${done ? " goal--done" : ""}`} role="status" aria-live="polite">
					<span className="goal__icon">
						<ObjectiveIcon type={level.objective.type} size={20} />
					</span>
					<span className="goal__text">
						<span className="goal__meta">
							{sandbox
								? FABRICS[level.cloth.fabric].name
								: `${level.world}–${level.n} · ${level.name}`}
						</span>
						<span className="goal__brief">{level.brief}</span>
					</span>
					<span className="goal__read">{hud.readout}</span>
					<span className="goal__bar">
						<span
							className="goal__fill"
							style={{ transform: `scaleX(${Math.max(0, Math.min(1, hud.progress))})` }}
						/>
					</span>
				</div>
				{hud.guard >= 0 && (
					<div className={`guard${hud.guard < 0.93 ? " guard--low" : ""}`}>
						<IconShield size={16} />
						<span className="guard__track">
							<span className="guard__fill" style={{ transform: `scaleX(${hud.guard})` }} />
						</span>
						{Math.round(hud.guard * 100)}%
					</div>
				)}
			</div>
			<div className="hud__side">
				{sandbox ? (
					<button
						type="button"
						className="round"
						aria-label="Fabric and world settings"
						onClick={onSheet}
					>
						<IconSliders size={22} />
					</button>
				) : (
					<button type="button" className="round" aria-label="Restart level" onClick={onRestart}>
						<IconRestart size={22} />
					</button>
				)}
				{hud.timeLeft !== null && (
					<span className={`chip${low ? " chip--warn" : ""}`} aria-label="Time left">
						<IconClock size={16} />
						{hud.timeLeft.toFixed(hud.timeLeft < 10 ? 1 : 0)}
					</span>
				)}
			</div>
		</header>
	);
}
