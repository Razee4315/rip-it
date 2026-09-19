import { ClothEngine } from "@/sim/ClothEngine";
import type { ToolId } from "@/sim/tools";
import type { GameStats } from "@/sim/types";
import { type MutableRefObject, useEffect, useRef } from "react";
import styled from "styled-components";

const Wrap = styled.div`
	position: absolute;
	inset: 0;
	overflow: hidden;
	touch-action: none;
	cursor: none;
`;

const Canvas = styled.canvas`
	position: absolute;
	inset: 0;
	display: block;
	touch-action: none;
	cursor: none;
`;

type Props = {
	tool: ToolId;
	matId: string;
	wind: number;
	gravity: number;
	slowmo: boolean;
	muted: boolean;
	resetKey: number;
	onStats: (s: GameStats) => void;
	onFirstTear: () => void;
	onParty: (show: boolean) => void;
	engineRef: MutableRefObject<ClothEngine | null>;
};

export function GameCanvas({
	tool,
	matId,
	wind,
	gravity,
	slowmo,
	muted,
	resetKey,
	onStats,
	onFirstTear,
	onParty,
	engineRef,
}: Props) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const cvRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const wrap = wrapRef.current;
		const cv = cvRef.current;
		if (!wrap || !cv) return;
		const engine = new ClothEngine(cv, {
			onStats,
			onFirstTear,
			onParty,
		});
		engineRef.current = engine;
		engine.mount(wrap);
		let resizeT: ReturnType<typeof setTimeout> | null = null;
		const onResize = () => {
			if (resizeT) clearTimeout(resizeT);
			resizeT = setTimeout(() => engine.resize(wrap), 250);
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			if (resizeT) clearTimeout(resizeT);
			engine.dispose();
			engineRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		engineRef.current?.setTool(tool);
	}, [tool, engineRef]);

	useEffect(() => {
		engineRef.current?.setWind(wind);
	}, [wind, engineRef]);

	useEffect(() => {
		engineRef.current?.setGravity(gravity);
	}, [gravity, engineRef]);

	useEffect(() => {
		engineRef.current?.setSlowmo(slowmo);
	}, [slowmo, engineRef]);

	useEffect(() => {
		engineRef.current?.setMuted(muted);
	}, [muted, engineRef]);

	useEffect(() => {
		if (resetKey > 0) engineRef.current?.freshCloth(matId);
	}, [resetKey, matId, engineRef]);

	useEffect(() => {
		const eng = engineRef.current;
		if (eng && eng.matId !== matId) eng.freshCloth(matId);
	}, [matId, engineRef]);

	return (
		<Wrap ref={wrapRef}>
			<Canvas ref={cvRef} />
		</Wrap>
	);
}
