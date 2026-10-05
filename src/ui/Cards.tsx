/** The modal cards: level briefing, pause, win, lose. */
import { audio } from "@/engine/audio/audio";
import { TOOLS } from "@/engine/tools";
import { DEFAULT_SAVE, type Settings } from "@/game/progress";
import type { LevelDef, LevelResult } from "@/game/types";
import { useEffect } from "react";
import {
	IconCheck,
	IconCross,
	IconGrid,
	IconNext,
	IconPlay,
	IconRestart,
	IconSound,
	IconSoundOff,
	IconStar,
	IconVibrate,
	ToolIcon,
} from "./icons";

function Stars3({ n, size = 14 }: { n: number; size?: number }) {
	return (
		<span className="rule__stars">
			{[1, 2, 3].map((i) => (
				<IconStar key={i} size={size} className={i <= n ? "on" : undefined} />
			))}
		</span>
	);
}

function levelTag(level: LevelDef) {
	return level.world > 0 ? `Level ${level.world}–${level.n}` : "Free play";
}

// ── briefing ────────────────────────────────────────────────────
export function IntroCard({ level, onStart }: { level: LevelDef; onStart: () => void }) {
	const limited = level.limits ?? {};
	return (
		<div className="scrim scrim--light">
			<div className="card" role="dialog" aria-modal="true" aria-label={level.name}>
				<div className="eyebrow">{levelTag(level)}</div>
				<h2 className="card__title">{level.name}</h2>
				<p className="card__sub">{level.brief}</p>
				<div className="kit" aria-label="Tools for this level">
					{level.tools.map((t) => {
						const l = limited[t];
						return (
							<span className="kit__tool" key={t} title={TOOLS[t].name}>
								<ToolIcon tool={t} size={22} />
								{l !== undefined && (
									<span className="tool__left">{TOOLS[t].unit === "seconds" ? `${l}s` : l}</span>
								)}
							</span>
						);
					})}
				</div>
				<ul className="rules">
					<li className="rule">
						<Stars3 n={1} />
						<span className="rule__label">
							{level.timeLimit ? `Finish within ${level.timeLimit}s` : "Finish the level"}
						</span>
					</li>
					<li className="rule">
						<Stars3 n={2} />
						<span className="rule__label">{level.stars[0].label}</span>
					</li>
					<li className="rule">
						<Stars3 n={3} />
						<span className="rule__label">{level.stars[1].label}</span>
					</li>
				</ul>
				{level.tip && <p className="card__tip">{level.tip}</p>}
				<div className="card__actions">
					<button type="button" className="btn btn--primary btn--wide" onClick={onStart}>
						<IconPlay size={20} />
						Start
					</button>
				</div>
			</div>
		</div>
	);
}

// ── settings rows (shared by pause and the title screen) ────────
type SettingsProps = {
	settings: Settings;
	onSettings: (s: Settings) => void;
};

export function SettingsRows({ settings, onSettings }: SettingsProps) {
	const q = settings.quality;
	return (
		<div className="rows">
			<div className="row">
				<span className="row__label">
					{settings.sound ? <IconSound size={20} /> : <IconSoundOff size={20} />}
					Sound
				</span>
				<button
					type="button"
					className="switch"
					role="switch"
					aria-checked={settings.sound}
					aria-label="Sound"
					onClick={() => onSettings({ ...settings, sound: !settings.sound })}
				/>
			</div>
			<div className="row">
				<span className="row__label">
					<IconVibrate size={20} />
					Vibration
				</span>
				<button
					type="button"
					className="switch"
					role="switch"
					aria-checked={settings.haptics}
					aria-label="Vibration"
					onClick={() => onSettings({ ...settings, haptics: !settings.haptics })}
				/>
			</div>
			{(
				[
					["gentleControls", "Gentle controls"],
					["reducedMotion", "Reduce shake & flashes"],
				] as const
			).map(([key, label]) => (
				<div className="row" key={key}>
					<span className="row__label">{label}</span>
					<button
						type="button"
						className="switch"
						role="switch"
						aria-checked={settings[key]}
						aria-label={label}
						onClick={() => onSettings({ ...settings, [key]: !settings[key] })}
					/>
				</div>
			))}
			<p className="settings-help">
				Hold to grab, then pull firmly to rip. Gentle controls give you more room to move before
				tearing.
			</p>
			<div className="row">
				<span className="row__label">Graphics</span>
				<span className="seg" role="group" aria-label="Graphics quality">
					{(["auto", "low", "medium", "high"] as const).map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={q === v}
							onClick={() => onSettings({ ...settings, quality: v })}
						>
							{v === "medium" ? "Med" : v[0].toUpperCase() + v.slice(1)}
						</button>
					))}
				</span>
			</div>
			<p className="settings-help">Auto adjusts graphics for smoother play. Low saves battery.</p>
			<button
				type="button"
				className="btn btn--small"
				onClick={() => onSettings({ ...DEFAULT_SAVE.settings })}
			>
				Reset settings
			</button>
		</div>
	);
}

// ── pause ───────────────────────────────────────────────────────
type PauseProps = SettingsProps & {
	level: LevelDef;
	onResume: () => void;
	onRestart: () => void;
	onLevels: () => void;
	onHome: () => void;
};

export function PauseCard({
	level,
	settings,
	onSettings,
	onResume,
	onRestart,
	onLevels,
	onHome,
}: PauseProps) {
	const sandbox = level.objective.type === "sandbox";
	return (
		<div className="scrim">
			<div className="card" role="dialog" aria-modal="true" aria-label="Paused">
				<div className="eyebrow">
					{levelTag(level)} · {level.name}
				</div>
				<h2 className="card__title">Paused</h2>
				<div className="card__actions" style={{ marginTop: 14 }}>
					<button type="button" className="btn btn--primary btn--wide" onClick={onResume}>
						<IconPlay size={20} />
						Resume
					</button>
				</div>
				<div className="card__actions" style={{ marginTop: 10 }}>
					<button type="button" className="btn btn--small" onClick={onRestart}>
						<IconRestart size={18} />
						{sandbox ? "Fresh cloth" : "Restart"}
					</button>
					<button type="button" className="btn btn--small" onClick={sandbox ? onHome : onLevels}>
						<IconGrid size={18} />
						{sandbox ? "Menu" : "Levels"}
					</button>
				</div>
				<SettingsRows settings={settings} onSettings={onSettings} />
			</div>
		</div>
	);
}

export function SettingsCard({
	settings,
	onSettings,
	onClose,
}: SettingsProps & { onClose: () => void }) {
	return (
		<div className="scrim">
			<div className="card" role="dialog" aria-modal="true" aria-label="Settings">
				<h2 className="card__title">Settings</h2>
				<SettingsRows settings={settings} onSettings={onSettings} />
				<div className="card__actions">
					<button type="button" className="btn btn--primary btn--wide" onClick={onClose}>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}

// ── win ─────────────────────────────────────────────────────────
type ResultProps = {
	level: LevelDef;
	result: LevelResult;
	hasNext: boolean;
	onRetry: () => void;
	onLevels: () => void;
	onNext: () => void;
};

export function ResultCard({ level, result, hasNext, onRetry, onLevels, onNext }: ResultProps) {
	// each star lands with its own chime
	useEffect(() => {
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let i = 0; i < result.stars; i++)
			timers.push(setTimeout(() => audio.star(i), 350 + i * 320));
		return () => timers.forEach(clearTimeout);
	}, [result]);

	// stars fill left to right regardless of which condition was missed
	const rows = [
		{
			label: level.timeLimit ? `Finish within ${level.timeLimit}s` : "Finish the level",
			won: true,
		},
		{ label: level.stars[0].label, won: result.earned[1] },
		{ label: level.stars[1].label, won: result.earned[2] },
	];
	return (
		<div className="scrim scrim--light">
			<div className="card" role="dialog" aria-modal="true" aria-label="Level complete">
				<div className="eyebrow">
					{levelTag(level)} · {level.name}
				</div>
				<div className="stars" aria-label={`${result.stars} of 3 stars`}>
					{[0, 1, 2].map((i) => (
						<IconStar
							key={i}
							size={i === 1 ? 72 : 58}
							className={`stars__star${i < result.stars ? " stars__star--on" : ""}`}
							style={{ animationDelay: `${0.35 + i * 0.32}s` }}
						/>
					))}
				</div>
				<h2 className="card__title">
					{result.stars === 3 ? (
						<>
							Ripped <em>it!</em>
						</>
					) : (
						"Level clear"
					)}
				</h2>
				<span className="stat">
					<b>{result.stats.time.toFixed(1)}s</b> on the clock
				</span>
				<ul className="rules">
					{rows.map((r) => (
						<li className={`rule${r.won ? " rule--won" : ""}`} key={r.label}>
							<IconStar
								size={16}
								className={r.won ? "on" : undefined}
								style={{ color: r.won ? "var(--gold)" : "var(--ink-500)" }}
							/>
							<span className="rule__label">{r.label}</span>
							<span className="rule__mark">
								{r.won ? <IconCheck size={18} /> : <IconCross size={18} />}
							</span>
						</li>
					))}
				</ul>
				<div className="card__actions">
					<button type="button" className="round" aria-label="Play again" onClick={onRetry}>
						<IconRestart size={22} />
					</button>
					<button type="button" className="round" aria-label="All levels" onClick={onLevels}>
						<IconGrid size={22} />
					</button>
					<button type="button" className="btn btn--primary" onClick={hasNext ? onNext : onLevels}>
						{hasNext ? "Next" : "Levels"}
						<IconNext size={20} />
					</button>
				</div>
			</div>
		</div>
	);
}

// ── lose ────────────────────────────────────────────────────────
export function FailCard({
	level,
	reason,
	onRetry,
	onLevels,
}: {
	level: LevelDef;
	reason: string;
	onRetry: () => void;
	onLevels: () => void;
}) {
	return (
		<div className="scrim scrim--light">
			<div className="card" role="dialog" aria-modal="true" aria-label="Level failed">
				<div className="eyebrow">
					{levelTag(level)} · {level.name}
				</div>
				<h2 className="card__title">So close</h2>
				<p className="card__sub">{reason}.</p>
				{level.tip && <p className="card__tip">{level.tip}</p>}
				<div className="card__actions">
					<button type="button" className="round" aria-label="All levels" onClick={onLevels}>
						<IconGrid size={22} />
					</button>
					<button type="button" className="btn btn--primary" onClick={onRetry}>
						<IconRestart size={20} />
						Try again
					</button>
				</div>
			</div>
		</div>
	);
}
