import { type RipSettings, loadSettings, saveSettings } from "@/lib/settings";
import type { ClothEngine } from "@/sim/ClothEngine";
import { TOOLS, type ToolId } from "@/sim/tools";
import type { GameStats, Milestone, PartyPayload } from "@/sim/types";
import { GlobalStyles, theme } from "@/theme";
import { GameCanvas } from "@/ui/GameCanvas";
import { Hud } from "@/ui/Hud";
import { PartyCard } from "@/ui/PartyCard";
import { Sheet } from "@/ui/Sheet";
import { ToolDock } from "@/ui/ToolDock";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "styled-components";
import styled from "styled-components";

const Shell = styled.div`
	position: fixed;
	inset: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	background: #0c0e12;
	height: 100dvh;
	padding-bottom: var(--keyboard-inset, 0px);
`;

const Stage = styled.main`
	position: relative;
	flex: 1;
	min-height: 0;
	min-width: 0;
`;

/** rip-game tip ladder: teach one verb at a time, advance on the matching milestone. */
const TIP_LADDER = ["Pinch and pull", "Try Scissors", "Try Torch on Paper"] as const;
const TIP_DONE = TIP_LADDER.length;
const TOAST_MS = 2600;
const IDLE_NUDGE = "Still there? Grab, cut, burn — or R for fresh cloth";

function App() {
	const engineRef = useRef<ClothEngine | null>(null);
	const [ready, setReady] = useState(false);
	const [tool, setTool] = useState<ToolId>("hand");
	const [matId, setMatId] = useState("silk");
	const [wind, setWind] = useState(0.12);
	const [gravity, setGravity] = useState(1);
	const [slowmo, setSlowmo] = useState(false);
	const [muted, setMuted] = useState(false);
	const [resetKey, setResetKey] = useState(0);
	const [sheet, setSheet] = useState<"world" | "overflow" | null>(null);
	const [tipStep, setTipStep] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const [party, setParty] = useState(false);
	const [partyStats, setPartyStats] = useState<PartyPayload | null>(null);
	const [stats, setStats] = useState<GameStats>({
		destroyed: 0,
		pieces: 1,
		fibers: 0,
		fps: 0,
		burning: 0,
	});
	const seenToolToasts = useRef<Set<ToolId>>(new Set());
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showToast = useCallback((text: string, ms = TOAST_MS) => {
		if (toastTimer.current) clearTimeout(toastTimer.current);
		setToast(text);
		toastTimer.current = setTimeout(() => setToast(null), ms);
	}, []);

	useEffect(() => {
		void loadSettings().then((s) => {
			setMuted(s.muted);
			setWind(s.wind);
			setGravity(s.gravity);
			setMatId(s.matId || "silk");
			if (TOOLS.some((t) => t.id === s.tool)) setTool(s.tool as ToolId);
			if (s.tutored) setTipStep(TIP_DONE);
			setReady(true);
		});
		return () => {
			if (toastTimer.current) clearTimeout(toastTimer.current);
		};
	}, []);

	const persist = useCallback((patch: Partial<RipSettings>) => {
		void loadSettings().then((cur) => {
			const next = { ...cur, ...patch };
			void saveSettings(next);
		});
	}, []);

	/** Single tool entry point — dock, sheet and hotkeys all land here. */
	const selectTool = useCallback(
		(id: ToolId) => {
			setTool(id);
			persist({ tool: id });
			// First-select toast per session (skip Hand — the tip chip owns that beat)
			if (id !== "hand" && !seenToolToasts.current.has(id)) {
				seenToolToasts.current.add(id);
				const t = TOOLS.find((x) => x.id === id);
				if (t) showToast(t.tip);
			}
		},
		[persist, showToast],
	);

	const onMilestone = useCallback((m: Milestone) => {
		setTipStep((s) => {
			const next = m === "tear" ? 1 : m === "cut" ? 2 : TIP_DONE;
			return Math.max(s, next);
		});
	}, []);

	useEffect(() => {
		if (tipStep >= TIP_DONE) persist({ tutored: true });
	}, [tipStep, persist]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// AC-19: Escape walks the same stack as Android back — party → World → overflow
			if (e.key === "Escape") {
				if (party) {
					e.preventDefault();
					setParty(false);
					return;
				}
				if (sheet === "world") {
					e.preventDefault();
					setSheet(null);
					return;
				}
				if (sheet === "overflow") {
					e.preventDefault();
					setSheet(null);
					return;
				}
				return;
			}
			const t = TOOLS.find((x) => x.key === e.key);
			if (t) {
				selectTool(t.id);
				return;
			}
			if (e.key === "r" || e.key === "R") {
				setParty(false);
				setResetKey((k) => k + 1);
			} else if (e.key === "s" || e.key === "S") setSlowmo((v) => !v);
			else if (e.key === "m" || e.key === "M") {
				setMuted((v) => {
					persist({ muted: !v });
					return !v;
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [persist, party, sheet, selectTool]);

	const fresh = () => {
		setParty(false);
		setResetKey((k) => k + 1);
	};

	const onParty = useCallback((p: PartyPayload | null) => {
		if (p) {
			setPartyStats(p);
			setParty(true);
		} else {
			setParty(false);
		}
	}, []);

	const onIdle = useCallback(() => {
		showToast(IDLE_NUDGE, 3400);
	}, [showToast]);

	if (!ready) {
		return (
			<ThemeProvider theme={theme}>
				<GlobalStyles />
				<Shell />
			</ThemeProvider>
		);
	}

	const tip = tipStep < TIP_DONE ? TIP_LADDER[tipStep] : null;

	return (
		<ThemeProvider theme={theme}>
			<GlobalStyles />
			<Shell className="app-container">
				<Stage>
					<GameCanvas
						tool={tool}
						matId={matId}
						wind={wind}
						gravity={gravity}
						slowmo={slowmo}
						muted={muted}
						resetKey={resetKey}
						engineRef={engineRef}
						onStats={setStats}
						onMilestone={onMilestone}
						onParty={onParty}
						onIdle={onIdle}
					/>
					<Hud
						tip={tip}
						toast={toast}
						onOpenWorld={() => setSheet("world")}
						onDismissTip={() => setTipStep((s) => Math.min(TIP_DONE, s + 1))}
					/>
					<ToolDock
						tool={tool}
						onTool={selectTool}
						onOverflow={() => setSheet((s) => (s === "overflow" ? null : "overflow"))}
						overflowOpen={sheet === "overflow"}
					/>
					{sheet && (
						<Sheet
							mode={sheet}
							matId={matId}
							tool={tool}
							wind={wind}
							gravity={gravity}
							slowmo={slowmo}
							muted={muted}
							destroyed={stats.destroyed}
							pieces={stats.pieces}
							fibers={stats.fibers}
							onClose={() => setSheet(null)}
							onMat={(id) => {
								setMatId(id);
								setParty(false);
								persist({ matId: id });
							}}
							onTool={selectTool}
							onWind={(v) => {
								setWind(v);
								persist({ wind: v });
							}}
							onGravity={(v) => {
								setGravity(v);
								persist({ gravity: v });
							}}
							onSlowmo={() => setSlowmo((v) => !v)}
							onMute={() => {
								setMuted((v) => {
									persist({ muted: !v });
									return !v;
								});
							}}
							onFresh={() => {
								fresh();
								setSheet(null);
							}}
						/>
					)}
					{party && <PartyCard stats={partyStats} onFresh={fresh} />}
				</Stage>
			</Shell>
		</ThemeProvider>
	);
}

export default App;
