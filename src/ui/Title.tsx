import { TOTAL_STARS } from "@/game/progress";
import { IconGrid, IconInfinity, IconPlay, IconSliders, IconStar } from "./icons";

type Props = {
	stars: number;
	/** e.g. "1–3" — the level Play will open */
	resume: string;
	fresh: boolean;
	onPlay: () => void;
	onLevels: () => void;
	onSandbox: () => void;
	onSettings: () => void;
};

/** Front page. The logo itself hangs in the scene behind — and yes, it rips. */
export function Title({ stars, resume, fresh, onPlay, onLevels, onSandbox, onSettings }: Props) {
	return (
		<div className="title">
			<div className="title__main">
				<button type="button" className="btn btn--primary btn--big" onClick={onPlay}>
					<IconPlay size={26} />
					{fresh ? "Play" : `Continue ${resume}`}
				</button>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
					<button type="button" className="btn btn--small" onClick={onLevels}>
						<IconGrid size={18} />
						Levels
					</button>
					<button type="button" className="btn btn--small" onClick={onSandbox}>
						<IconInfinity size={18} />
						Free play
					</button>
				</div>
			</div>
			<div className="title__foot">
				<span className="chip chip--gold" aria-label={`${stars} of ${TOTAL_STARS} stars`}>
					<IconStar size={16} />
					{stars}
					<span style={{ color: "var(--muted)" }}>/ {TOTAL_STARS}</span>
				</span>
				<button type="button" className="round" aria-label="Settings" onClick={onSettings}>
					<IconSliders size={22} />
				</button>
			</div>
			<span className="title__ver">v{import.meta.env.VITE_APP_VERSION}</span>
		</div>
	);
}
