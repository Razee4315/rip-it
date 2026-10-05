import { Game } from "@/engine/Game";
import { audio } from "@/engine/audio/audio";
import { ENVS } from "@/engine/gfx/environments";
import { ALL_TOOLS, TOOLS, type ToolId } from "@/engine/tools";
import { LEVELS, nextLevel } from "@/game/levels";
import {
	type Save,
	type Settings,
	isLevelOpen,
	loadSave,
	persist,
	resumeLevel,
	totalStars,
	withResult,
} from "@/game/progress";
import { DEFAULT_SANDBOX, type SandboxOpts, sandboxLevel, titleLevel } from "@/game/sandbox";
import type { HudState, LevelDef, LevelResult } from "@/game/types";
import { FailCard, IntroCard, PauseCard, ResultCard, SettingsCard } from "@/ui/Cards";
import { Dock, type Toast } from "@/ui/Dock";
import { Hud } from "@/ui/Hud";
import { Levels } from "@/ui/Levels";
import { type Dials, SandboxSheet } from "@/ui/Sandbox";
import { Title } from "@/ui/Title";
import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "boot" | "title" | "levels" | "play";
type Modal = null | "intro" | "pause" | "result" | "fail" | "settings";

const BLANK_HUD: HudState = {
	progress: 0,
	readout: "",
	time: 0,
	timeLeft: null,
	left: {},
	guard: -1,
	fps: 60,
	started: false,
};

/** Notch / gesture-bar insets, read from CSS so the 3D framing can respect them. */
function readSafeArea() {
	const d = document.createElement("div");
	d.style.cssText =
		"position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
	document.body.appendChild(d);
	const cs = getComputedStyle(d);
	const out = {
		top: Number.parseFloat(cs.paddingTop) || 0,
		bottom: Number.parseFloat(cs.paddingBottom) || 0,
	};
	d.remove();
	return out;
}

/** Wait for the display face so the banner's printed logo is drawn in it. */
function fontsReady(): Promise<unknown> {
	if (!document.fonts?.load) return Promise.resolve();
	const wait = Promise.all([
		document.fonts.load('400 96px "Anton"'),
		document.fonts.load('600 16px "Outfit Variable"'),
	]);
	const timeout = new Promise((r) => setTimeout(r, 1800));
	return Promise.race([wait, timeout]).catch(() => undefined);
}

export default function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const gameRef = useRef<Game | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const toastId = useRef(0);
	const transition = useRef(0);

	const [fatal, setFatal] = useState<string | null>(null);
	const [save, setSave] = useState<Save | null>(null);
	const [screen, setScreen] = useState<Screen>("boot");
	const [level, setLevel] = useState<LevelDef | null>(null);
	const [modal, setModal] = useState<Modal>(null);
	const [tool, setTool] = useState<ToolId>("hand");
	const [hud, setHud] = useState<HudState>(BLANK_HUD);
	const [result, setResult] = useState<LevelResult | null>(null);
	const [failReason, setFailReason] = useState("");
	const [toast, setToast] = useState<Toast | null>(null);
	const [sandbox, setSandbox] = useState<SandboxOpts>(DEFAULT_SANDBOX);
	const [sheet, setSheet] = useState(false);
	const [dials, setDials] = useState<Dials>({ wind: 0, gravity: 1, slowmo: false });
	const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });

	const showToast = useCallback((text: string, title?: string) => {
		if (toastTimer.current) clearTimeout(toastTimer.current);
		setToast({ id: ++toastId.current, text, title });
		toastTimer.current = setTimeout(() => setToast(null), 2800);
	}, []);

	// ── boot: one engine for the life of the page ──
	useEffect(() => {
		const cv = canvasRef.current;
		if (!cv) return;
		let game: Game;
		try {
			game = new Game(cv);
		} catch (e) {
			setFatal(e instanceof Error ? e.message : String(e));
			return;
		}
		gameRef.current = game;
		const fit = () => {
			game.resize(window.innerWidth, window.innerHeight);
			setView({ w: window.innerWidth, h: window.innerHeight });
		};
		fit();
		window.addEventListener("resize", fit);
		let alive = true;
		void Promise.all([loadSave(), fontsReady()]).then(([s]) => {
			if (!alive) return;
			setSave(s);
			audio.setMuted(!s.settings.sound);
			game.setHaptics(s.settings.haptics);
			game.setControls(s.settings.gentleControls, s.settings.reducedMotion);
			game.setQuality(s.settings.quality);
			try {
				game.load(titleLevel());
				game.start();
				setScreen("title");
			} catch (e) {
				setFatal(e instanceof Error ? e.message : String(e));
			}
		});
		return () => {
			alive = false;
			transition.current++;
			window.removeEventListener("resize", fit);
			game.dispose();
			gameRef.current = null;
		};
	}, []);

	// ── engine → interface ──
	useEffect(() => {
		const g = gameRef.current;
		if (!g) return;
		g.cb = {
			onHud: setHud,
			onHint: (m) => showToast(m),
			onComplete: (r) => {
				setResult(r);
				setModal("result");
				setSave((prev) => {
					if (!prev) return prev;
					const next = withResult(prev, r);
					persist(next);
					return next;
				});
			},
			onFail: (reason) => {
				setFailReason(reason);
				setModal("fail");
			},
		};
	});

	// Menus and configuration must not consume tool fuel or advance objectives.
	useEffect(() => {
		gameRef.current?.setPaused(modal !== null || sheet || screen === "levels");
	}, [modal, sheet, screen]);

	// ── keep the cloth framed between the top bar and the dock ──
	const toolCount = level?.tools.length ?? 1;
	useEffect(() => {
		const g = gameRef.current;
		if (!g || screen === "boot") return;
		const safe = readSafeArea();
		if (screen === "play") {
			const perRow = Math.max(1, Math.floor((Math.min(view.w, 620) - 36) / 62));
			const rows = Math.ceil(toolCount / perRow);
			g.setInsets(66 + safe.top, 30 + safe.bottom + rows * 62);
		} else {
			// title: the banner hangs in the upper part, buttons live below it
			const wide = view.w / view.h > 1.2;
			g.setInsets(14 + safe.top, Math.round(view.h * (wide ? 0.3 : 0.4)));
		}
	}, [screen, view, toolCount]);

	// ── moving between screens ──
	const enter = useCallback(async (lv: LevelDef, intro: boolean, keepSheet = false) => {
		const g = gameRef.current;
		if (!g) return;
		setModal(null);
		if (!keepSheet) setSheet(false);
		const request = ++transition.current;
		g.setPaused(true);
		await g.fadeOut();
		if (request !== transition.current || gameRef.current !== g) return;
		g.setPaused(false);
		g.setSlowmo(false);
		g.setGravityScale(1);
		g.load(lv);
		g.setPaused(intro || keepSheet);
		setLevel(lv);
		setTool(g.tool);
		setHud(BLANK_HUD);
		setResult(null);
		setDials({ wind: 0, gravity: 1, slowmo: false });
		setScreen("play");
		setModal(intro ? "intro" : null);
	}, []);

	const goTitle = useCallback(async () => {
		const g = gameRef.current;
		if (!g) return;
		setModal(null);
		setSheet(false);
		const request = ++transition.current;
		g.setPaused(true);
		await g.fadeOut();
		if (request !== transition.current || gameRef.current !== g) return;
		g.setPaused(false);
		g.setSlowmo(false);
		g.setGravityScale(1);
		g.load(titleLevel());
		setLevel(null);
		setScreen("title");
	}, []);

	const pickTool = useCallback(
		(t: ToolId) => {
			audio.wake();
			audio.tap();
			gameRef.current?.setTool(t);
			setTool(t);
			showToast(TOOLS[t].hint, TOOLS[t].name);
		},
		[showToast],
	);

	const pause = useCallback(() => {
		audio.tap();
		gameRef.current?.setPaused(true);
		setSheet(false);
		setModal("pause");
	}, []);

	const resume = useCallback(() => {
		audio.tap();
		gameRef.current?.setPaused(false);
		setModal(null);
	}, []);

	const changeSettings = useCallback((s: Settings) => {
		audio.setMuted(!s.sound);
		if (s.sound) audio.tap();
		gameRef.current?.setHaptics(s.haptics);
		gameRef.current?.setControls(s.gentleControls, s.reducedMotion);
		gameRef.current?.setQuality(s.quality);
		setSave((prev) => {
			if (!prev) return prev;
			const next = { ...prev, settings: s };
			persist(next);
			return next;
		});
	}, []);

	const changeSandbox = useCallback(
		(o: SandboxOpts) => {
			setSandbox(o);
			void enter(sandboxLevel(o), false, true);
		},
		[enter],
	);

	const changeDials = useCallback(
		(d: Dials) => {
			const g = gameRef.current;
			setDials(d);
			if (!g || !level) return;
			const base = Math.abs(ENVS[level.env].wind[0]) || 0.1;
			g.setWindScale(d.wind / base);
			g.setGravityScale(d.gravity);
			g.setSlowmo(d.slowmo);
		},
		[level],
	);

	// ── keyboard (desktop) ──
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
			if (
				e.target instanceof HTMLElement &&
				e.target.matches("input, select, textarea, [contenteditable]")
			)
				return;
			if (e.key === "Escape") {
				if (sheet) setSheet(false);
				else if (modal === "pause") resume();
				else if (modal === "settings") setModal(null);
				else if (screen === "play" && modal === null) pause();
				else if (screen === "levels") setScreen("title");
				return;
			}
			if (screen !== "play" || !level) return;
			if (modal === "intro" && (e.key === "Enter" || e.key === " ")) {
				setModal(null);
				return;
			}
			if (modal !== null || sheet) return;
			const t = ALL_TOOLS.find((id) => TOOLS[id].key === e.key);
			if (t && level.tools.includes(t)) pickTool(t);
			else if (e.key === "r" || e.key === "R") void enter(level, false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [screen, modal, sheet, level, pause, resume, pickTool, enter]);

	// ── render ──
	if (fatal) {
		return (
			<div className="app">
				<div className="fatal">
					<div>
						<h1>Can't start</h1>
						<p>RIP IT! needs WebGL 2 graphics, which this device or browser didn't provide.</p>
						<p style={{ fontSize: 12, opacity: 0.6 }}>{fatal}</p>
					</div>
				</div>
			</div>
		);
	}

	const upcoming = level ? nextLevel(level.id) : undefined;
	const hasNext = !!upcoming && !!save && isLevelOpen(save, upcoming);
	const resumeAt = save ? resumeLevel(save) : LEVELS[0];

	return (
		<div className="app">
			<canvas ref={canvasRef} className="app__canvas" />

			{screen === "title" && save && (
				<div className="layer">
					<Title
						stars={totalStars(save)}
						resume={`${resumeAt.world}–${resumeAt.n}`}
						fresh={totalStars(save) === 0}
						onPlay={() => {
							audio.wake();
							audio.swish();
							void enter(resumeAt, true);
						}}
						onLevels={() => {
							audio.wake();
							audio.tap();
							setScreen("levels");
						}}
						onSandbox={() => {
							audio.wake();
							audio.swish();
							void enter(sandboxLevel(sandbox), false);
						}}
						onSettings={() => {
							audio.wake();
							audio.tap();
							setModal("settings");
						}}
					/>
				</div>
			)}

			{screen === "levels" && save && (
				<div className="layer">
					<Levels
						save={save}
						onBack={() => {
							audio.tap();
							if (level) void goTitle();
							else setScreen("title");
						}}
						onPick={(l) => {
							audio.swish();
							void enter(l, true);
						}}
					/>
				</div>
			)}

			{screen === "play" && level && (
				<div className="layer">
					<Hud
						level={level}
						hud={hud}
						onPause={pause}
						onRestart={() => {
							audio.tap();
							void enter(level, false);
						}}
						onSheet={() => {
							audio.tap();
							setSheet((v) => !v);
						}}
					/>
					{!sheet && (
						<Dock tools={level.tools} tool={tool} left={hud.left} toast={toast} onTool={pickTool} />
					)}
					{sheet && level.objective.type === "sandbox" && (
						<SandboxSheet
							opts={sandbox}
							dials={dials}
							onOpts={changeSandbox}
							onDials={changeDials}
							onFresh={() => {
								audio.swish();
								void enter(sandboxLevel(sandbox), false, true);
							}}
							onClose={() => setSheet(false)}
						/>
					)}
				</div>
			)}

			{save && (
				<div className="layer">
					{modal === "intro" && level && (
						<IntroCard
							level={level}
							onStart={() => {
								audio.wake();
								audio.tap();
								setModal(null);
							}}
						/>
					)}
					{modal === "pause" && level && (
						<PauseCard
							level={level}
							settings={save.settings}
							onSettings={changeSettings}
							onResume={resume}
							onRestart={() => void enter(level, false)}
							onLevels={() => {
								gameRef.current?.setPaused(false);
								setModal(null);
								setScreen("levels");
							}}
							onHome={() => void goTitle()}
						/>
					)}
					{modal === "settings" && (
						<SettingsCard
							settings={save.settings}
							onSettings={changeSettings}
							onClose={() => setModal(null)}
						/>
					)}
					{modal === "result" && level && result && (
						<ResultCard
							level={level}
							result={result}
							hasNext={hasNext}
							onRetry={() => void enter(level, false)}
							onLevels={() => {
								setModal(null);
								setScreen("levels");
							}}
							onNext={() => {
								if (upcoming) void enter(upcoming, true);
							}}
						/>
					)}
					{modal === "fail" && level && (
						<FailCard
							level={level}
							reason={failReason}
							onRetry={() => void enter(level, false)}
							onLevels={() => {
								setModal(null);
								setScreen("levels");
							}}
						/>
					)}
				</div>
			)}
		</div>
	);
}
