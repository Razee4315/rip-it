/** The modal cards: level briefing, pause, win, lose. */
import { audio } from "@/engine/audio/audio";
import { TOOLS } from "@/engine/tools";
import { DEFAULT_SAVE, type Settings } from "@/game/progress";
import type { LevelDef, LevelResult } from "@/game/types";
import { useEffect, useState } from "react";
import {
	IconCheck,
	IconCross,
	IconGrid,
	IconNext,
	IconPlay,
	IconRestart,
	IconSliders,
	IconStar,
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
	const [section, setSection] = useState<"Play" | "Audio" | "Graphics">("Play");
	const switches =
		section === "Play"
			? ([
					["haptics", "Vibration"],
					["gentleControls", "Gentle controls"],
					["reducedMotion", "Reduce flashes & motion"],
				] as const)
			: ([
					["sound", "Audio"],
					["ambience", "Ambient sounds"],
					["music", "Music"],
				] as const);
	return (
		<>
			<div className="settings-nav seg" role="group" aria-label="Settings category">
				{(["Play", "Audio", "Graphics"] as const).map((name) => (
					<button
						type="button"
						key={name}
						aria-pressed={section === name}
						onClick={() => setSection(name)}
					>
						{name}
					</button>
				))}
			</div>
			<div className="rows settings-panel">
				{section !== "Graphics" &&
					switches.map(([key, label]) => (
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
				{section === "Play" && (
					<p className="settings-help">
						Hold to grab, then pull firmly to rip. Gentle controls allow a longer pull before
						tearing.
					</p>
				)}
				{section === "Audio" && (
					<>
						<label className="volume-control">
							Volume <output>{Math.round(settings.volume * 100)}%</output>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								value={Math.round(settings.volume * 100)}
								onChange={(e) => onSettings({ ...settings, volume: Number(e.target.value) / 100 })}
							/>
						</label>
						<p className="settings-help">
							Music is optional. Keep it off to focus on the fabric and surrounding sounds.
						</p>
					</>
				)}
				{section === "Graphics" && (
					<>
						<span className="row__label">Quality</span>
						<div className="seg settings-quality" role="group" aria-label="Graphics quality">
							{(["auto", "low", "medium", "high"] as const).map((v) => (
								<button
									type="button"
									key={v}
									aria-pressed={settings.quality === v}
									onClick={() => onSettings({ ...settings, quality: v })}
								>
									{v === "medium" ? "Medium" : v[0].toUpperCase() + v.slice(1)}
								</button>
							))}
						</div>
						<p className="settings-help">
							Auto balances detail and smooth play for your device. Low reduces effects and saves
							battery.
						</p>
					</>
				)}
			</div>
			<button
				type="button"
				className="btn btn--small settings-reset"
				onClick={() => onSettings({ ...DEFAULT_SAVE.settings })}
			>
				Reset all settings
			</button>
		</>
	);
}

// ── pause ───────────────────────────────────────────────────────
type PauseProps = {
	onOpenSettings: () => void;
	level: LevelDef;
	onResume: () => void;
	onRestart: () => void;
	onLevels: () => void;
	onHome: () => void;
};

export function PauseCard({
	level,
	onOpenSettings,
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
				<button type="button" className="btn btn--wide pause-settings" onClick={onOpenSettings}>
					<IconSliders size={18} />
					Settings
				</button>
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
