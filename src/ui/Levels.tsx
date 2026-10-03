import { WORLDS, levelsOfWorld } from "@/game/levels";
import {
	type Save,
	TOTAL_STARS,
	WORLD_GATE,
	doneInWorld,
	isLevelOpen,
	isWorldOpen,
	resumeLevel,
	starsInWorld,
	totalStars,
} from "@/game/progress";
import type { LevelDef } from "@/game/types";
import type { CSSProperties } from "react";
import { Wordmark } from "./Wordmark";
import { IconBack, IconLock, IconStar } from "./icons";

type Props = {
	save: Save;
	onBack: () => void;
	onPick: (level: LevelDef) => void;
};

/** Four worlds, six levels each. */
export function Levels({ save, onBack, onPick }: Props) {
	const next = resumeLevel(save);
	return (
		<div className="levels">
			<div className="levels__head">
				<button type="button" className="round" aria-label="Back" onClick={onBack}>
					<IconBack size={24} />
				</button>
				<h1>
					<Wordmark size={26} />
				</h1>
				<span
					className="chip chip--gold"
					aria-label={`${totalStars(save)} of ${TOTAL_STARS} stars`}
				>
					<IconStar size={16} />
					{totalStars(save)}
					<span style={{ color: "var(--muted)" }}>/ {TOTAL_STARS}</span>
				</span>
			</div>
			<div className="levels__body">
				{WORLDS.map((w) => {
					const open = isWorldOpen(save, w.n);
					const prev = WORLDS[w.n - 2];
					const need = prev ? WORLD_GATE - doneInWorld(save, prev.n) : 0;
					return (
						<section
							key={w.n}
							className={`world${open ? "" : " world--locked"}`}
							aria-label={w.name}
						>
							<div
								className="world__art"
								style={{ "--h1": w.hue[0], "--h2": w.hue[1] } as CSSProperties}
							>
								<span className="world__num" aria-hidden="true">
									{w.n}
								</span>
								<div className="eyebrow" style={{ color: "rgba(255,255,255,.75)" }}>
									World {w.n}
								</div>
								<h2 className="world__name">{w.name}</h2>
								<p className="world__tag">{w.tagline}</p>
								{open && (
									<span className="world__stars">
										<IconStar size={14} />
										{starsInWorld(save, w.n)} / 18
									</span>
								)}
							</div>
							{open ? (
								<div className="world__grid">
									{levelsOfWorld(w.n).map((l) => {
										const stars = save.stars[l.id] ?? 0;
										const can = isLevelOpen(save, l);
										const isNext = can && l.id === next.id && stars === 0;
										return (
											<button
												key={l.id}
												type="button"
												className={`tile${can ? "" : " tile--locked"}${isNext ? " tile--next" : ""}`}
												disabled={!can}
												aria-label={`Level ${l.world}-${l.n}, ${l.name}${can ? `, ${stars} stars` : ", locked"}`}
												onClick={() => onPick(l)}
											>
												{can ? <span className="tile__n">{l.n}</span> : <IconLock size={26} />}
												<span className="tile__name">{l.name}</span>
												<span className="tile__stars">
													{[1, 2, 3].map((i) => (
														<IconStar key={i} size={15} className={i <= stars ? "on" : undefined} />
													))}
												</span>
											</button>
										);
									})}
								</div>
							) : (
								<div className="world__lock">
									<IconLock size={22} />
									<span>
										Finish {need} more level{need === 1 ? "" : "s"} in {prev?.name} to open this
										world.
									</span>
								</div>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
