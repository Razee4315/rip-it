import { FABRICS, FABRIC_ORDER } from "@/engine/cloth/fabrics";
import { DYES, DYE_NAMES, MOUNTS, PLACES, type SandboxOpts } from "@/game/sandbox";
import { IconCross, IconRestart } from "./icons";

export type Dials = { wind: number; gravity: number; slowmo: boolean };

type Props = {
	opts: SandboxOpts;
	dials: Dials;
	onOpts: (o: SandboxOpts) => void;
	onDials: (d: Dials) => void;
	onFresh: () => void;
	onClose: () => void;
};

/** Free play controls: pick a fabric, hang it somewhere, change the weather. */
export function SandboxSheet({ opts, dials, onOpts, onDials, onFresh, onClose }: Props) {
	return (
		<div className="sheet" role="dialog" aria-modal="true" aria-label="Free play settings">
			<div className="sheet__head">
				<h2>Free play</h2>
				<button type="button" className="btn btn--small btn--primary" onClick={onFresh}>
					<IconRestart size={18} />
					Fresh cloth
				</button>
				<button type="button" className="round round--ghost" aria-label="Close" onClick={onClose}>
					<IconCross size={22} />
				</button>
			</div>
			<div className="sheet__body">
				<section className="group">
					<h3 className="eyebrow">Fabric</h3>
					<div className="swatches">
						{FABRIC_ORDER.map((id) => (
							<button
								key={id}
								type="button"
								className="swatch"
								aria-pressed={opts.fabric === id}
								title={FABRICS[id].blurb}
								onClick={() => onOpts({ ...opts, fabric: id })}
							>
								<i className={`fab-${id}`} />
								{FABRICS[id].name}
							</button>
						))}
					</div>
				</section>

				<section className="group">
					<h3 className="eyebrow">Dye</h3>
					<div className="dyes">
						{DYES.map((d, i) => (
							<button
								key={d || "natural"}
								type="button"
								className="dye"
								aria-pressed={opts.dye === d}
								aria-label={DYE_NAMES[i]}
								title={DYE_NAMES[i]}
								style={{ background: d || "var(--ink-700)" }}
								onClick={() => onOpts({ ...opts, dye: d })}
							>
								{!d && <IconCross size={16} />}
							</button>
						))}
					</div>
				</section>

				<section className="group">
					<h3 className="eyebrow">Hang it from</h3>
					<div className="pills">
						{MOUNTS.map((m) => (
							<button
								key={m.id}
								type="button"
								className="pill"
								aria-pressed={opts.mount === m.id}
								onClick={() => onOpts({ ...opts, mount: m.id })}
							>
								{m.name}
							</button>
						))}
					</div>
				</section>

				<section className="group">
					<h3 className="eyebrow">Place</h3>
					<div className="pills">
						{PLACES.map((p) => (
							<button
								key={p.id}
								type="button"
								className="pill"
								aria-pressed={opts.env === p.id}
								onClick={() => onOpts({ ...opts, env: p.id })}
							>
								{p.name}
							</button>
						))}
					</div>
				</section>

				<section className="group">
					<h3 className="eyebrow">World</h3>
					<p className="settings-help">0 is still air. Try 0.5 for a light breeze.</p>
					<label className="slider">
						Wind m/s
						<input
							type="range"
							min={0}
							max={5}
							step={0.1}
							value={dials.wind}
							onChange={(e) => onDials({ ...dials, wind: Number(e.target.value) })}
						/>
						<output>{dials.wind.toFixed(1)}</output>
					</label>
					<label className="slider">
						Gravity
						<input
							type="range"
							min={0.1}
							max={2}
							step={0.05}
							value={dials.gravity}
							onChange={(e) => onDials({ ...dials, gravity: Number(e.target.value) })}
						/>
						<output>{dials.gravity.toFixed(1)}×</output>
					</label>
					<div className="row" style={{ marginTop: 6 }}>
						<span className="row__label">Slow motion</span>
						<button
							type="button"
							className="switch"
							role="switch"
							aria-checked={dials.slowmo}
							aria-label="Slow motion"
							onClick={() => onDials({ ...dials, slowmo: !dials.slowmo })}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
