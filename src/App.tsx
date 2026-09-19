import { type RipSettings, loadSettings, saveSettings } from "@/lib/settings";
import type { ClothEngine } from "@/sim/ClothEngine";
import { TOOLS, type ToolId } from "@/sim/tools";
import type { GameStats } from "@/sim/types";
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
	const [showTip, setShowTip] = useState(true);
	const [party, setParty] = useState(false);
	const [stats, setStats] = useState<GameStats>({
		destroyed: 0,
		pieces: 1,
		fibers: 0,
		fps: 0,
		burning: 0,
	});

	useEffect(() => {
		void loadSettings().then((s) => {
			setMuted(s.muted);
			setWind(s.wind);
			setGravity(s.gravity);
			setMatId(s.matId || "silk");
			if (TOOLS.some((t) => t.id === s.tool)) setTool(s.tool as ToolId);
			setReady(true);
		});
	}, []);

	const persist = useCallback((patch: Partial<RipSettings>) => {
		void loadSettings().then((cur) => {
			const next = { ...cur, ...patch };
			void saveSettings(next);
		});
	}, []);

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
				setTool(t.id);
				persist({ tool: t.id });
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
	}, [persist, party, sheet]);

	const fresh = () => {
		setParty(false);
		setResetKey((k) => k + 1);
	};

	if (!ready) {
		return (
			<ThemeProvider theme={theme}>
				<GlobalStyles />
				<Shell />
			</ThemeProvider>
		);
	}

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
						onFirstTear={() => setShowTip(false)}
						onParty={setParty}
					/>
					<Hud
						showTip={showTip}
						onOpenWorld={() => setSheet("world")}
						onDismissTip={() => setShowTip(false)}
					/>
					<ToolDock
						tool={tool}
						onTool={(id) => {
							setTool(id);
							persist({ tool: id });
						}}
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
							onTool={(id) => {
								setTool(id);
								persist({ tool: id });
							}}
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
					{party && <PartyCard onFresh={fresh} />}
				</Stage>
			</Shell>
		</ThemeProvider>
	);
}

export default App;
