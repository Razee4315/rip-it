/** Hand-drawn icon set: 24-unit grid, round joins, currentColor. */
import type { ToolId } from "@/engine/tools";
import type { Objective } from "@/game/types";
import type { ReactNode, SVGProps } from "react";

type P = { size?: number } & Omit<SVGProps<SVGSVGElement>, "ref">;

function Svg({ size = 24, children, ...rest }: P & { children: ReactNode }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{...rest}
		>
			{children}
		</svg>
	);
}

// ── tools ───────────────────────────────────────────────────────
export const IconHand = (p: P) => (
	<Svg {...p}>
		<path d="M8 13V5.6a1.5 1.5 0 0 1 3 0V11" />
		<path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5" />
		<path d="M14 11V5.6a1.5 1.5 0 0 1 3 0V12" />
		<path d="M17 12V8.2a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.3a6 6 0 0 1-4.6-2.2l-3.5-4.4a1.6 1.6 0 0 1 2.4-2.1L8 15.2" />
	</Svg>
);

export const IconScissors = (p: P) => (
	<Svg {...p}>
		<circle cx="6" cy="6.2" r="2.7" />
		<circle cx="6" cy="17.8" r="2.7" />
		<path d="M8.3 7.8 20.5 17" />
		<path d="M8.3 16.2 20.5 7" />
	</Svg>
);

export const IconBlade = (p: P) => (
	<Svg {...p}>
		<path
			d="M9.2 14.8 19.6 4.4a1.5 1.5 0 0 1 2.1 2.1c-1.9 4-5.2 8-10.2 11z"
			fill="currentColor"
			fillOpacity={0.22}
		/>
		<path d="M3 21l6.2-6.2" strokeWidth={3} />
		<path d="M7.4 13l3.6 3.6" />
	</Svg>
);

export const IconTorch = (p: P) => (
	<Svg {...p}>
		<path
			d="M12 2.8c.9 3.3 5.2 5.3 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.4 2.1-4.4.2 1.5.8 2.5 1.8 2.8-.6-2.9.1-6.2 1.3-8.6z"
			fill="currentColor"
			fillOpacity={0.22}
		/>
		<path d="M12 21.2a2.6 2.6 0 0 0 2.6-2.6c0-1.6-1.4-2.3-2.6-4.1-1.2 1.8-2.6 2.5-2.6 4.1a2.6 2.6 0 0 0 2.6 2.6z" />
	</Svg>
);

export const IconWater = (p: P) => (
	<Svg {...p}>
		<path
			d="M12 3s6.2 6.3 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 9.3 12 3 12 3z"
			fill="currentColor"
			fillOpacity={0.22}
		/>
		<path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.7" />
	</Svg>
);

export const IconCracker = (p: P) => (
	<Svg {...p}>
		<rect
			x="5.6"
			y="9.4"
			width="7.4"
			height="12"
			rx="1.8"
			transform="rotate(-24 9.3 15.4)"
			fill="currentColor"
			fillOpacity={0.22}
		/>
		<path d="M6 13.2l6.6-3" />
		<path d="M12.6 8.4c.9-2.3 2.6-3 4.6-2.6" />
		<path d="M20 2.6v2.2M22.4 6h-2.2M21.6 3.4l-1.4 1.4" />
	</Svg>
);

export const IconPin = (p: P) => (
	<Svg {...p}>
		<path d="M9 3.6h6l-1 5.2 3.2 3.2v2H6.8v-2L10 8.8z" fill="currentColor" fillOpacity={0.22} />
		<path d="M12 14v7.4" />
	</Svg>
);

export const IconNeedle = (p: P) => (
	<Svg {...p}>
		<path d="M20.6 3.4 5.4 18.6" />
		<path d="M5.4 18.6 3 21" strokeWidth={1.4} />
		<path
			d="M18.4 5.6c2.6 1.8 2.8 4.9.2 6.6-2.4 1.6-3.8 3.6-3 6.4.3 1.1 1 1.9 1.9 2.4"
			strokeWidth={1.5}
		/>
		<path d="M17.7 4.9l1.4 1.4" strokeWidth={3} />
	</Svg>
);

export const IconBlower = (p: P) => (
	<Svg {...p}>
		<path d="M2.6 8h9.6a2.6 2.6 0 1 0-2.6-2.6" />
		<path d="M2.6 12h15.6a2.7 2.7 0 1 1-2.7 2.7" />
		<path d="M2.6 16h7.2a2.5 2.5 0 1 1-2.5 2.5" />
	</Svg>
);

const TOOL_ICONS: Record<ToolId, (p: P) => JSX.Element> = {
	hand: IconHand,
	scissors: IconScissors,
	blade: IconBlade,
	torch: IconTorch,
	water: IconWater,
	cracker: IconCracker,
	pin: IconPin,
	needle: IconNeedle,
	blower: IconBlower,
};

export function ToolIcon({ tool, size }: { tool: ToolId; size?: number }) {
	const C = TOOL_ICONS[tool];
	return <C size={size} />;
}

// ── interface ───────────────────────────────────────────────────
export const IconPlay = (p: P) => (
	<Svg {...p}>
		<path d="M7.5 4.6v14.8L20 12z" fill="currentColor" />
	</Svg>
);

export const IconPause = (p: P) => (
	<Svg {...p}>
		<path d="M8 5v14M16 5v14" strokeWidth={3.4} />
	</Svg>
);

export const IconRestart = (p: P) => (
	<Svg {...p}>
		<path d="M4 12a8 8 0 1 0 2.7-6" />
		<path d="M3.6 3.6v5h5" />
	</Svg>
);

export const IconGrid = (p: P) => (
	<Svg {...p}>
		<rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
		<rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
		<rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
		<rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
	</Svg>
);

export const IconSliders = (p: P) => (
	<Svg {...p}>
		<path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
		<circle cx="15" cy="7" r="2.2" />
		<circle cx="9" cy="17" r="2.2" />
	</Svg>
);

export const IconSound = (p: P) => (
	<Svg {...p}>
		<path d="M4 9.5v5h3.4L12 18.6V5.4L7.4 9.5z" fill="currentColor" fillOpacity={0.22} />
		<path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.4a8 8 0 0 1 0 11.2" />
	</Svg>
);

export const IconSoundOff = (p: P) => (
	<Svg {...p}>
		<path d="M4 9.5v5h3.4L12 18.6V5.4L7.4 9.5z" fill="currentColor" fillOpacity={0.22} />
		<path d="M16 9.5l5 5M21 9.5l-5 5" />
	</Svg>
);

export const IconVibrate = (p: P) => (
	<Svg {...p}>
		<rect x="8" y="3.5" width="8" height="17" rx="2" />
		<path d="M4.4 9v6M2 10.6v2.8M19.6 9v6M22 10.6v2.8" />
	</Svg>
);

export const IconStar = ({ filled = true, ...p }: P & { filled?: boolean }) => (
	<Svg {...p} strokeWidth={filled ? 0 : 1.8}>
		<path
			d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"
			fill={filled ? "currentColor" : "none"}
		/>
	</Svg>
);

export const IconLock = (p: P) => (
	<Svg {...p}>
		<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor" fillOpacity={0.22} />
		<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
	</Svg>
);

export const IconBack = (p: P) => (
	<Svg {...p}>
		<path d="M14.5 5.5 8 12l6.5 6.5" />
	</Svg>
);

export const IconNext = (p: P) => (
	<Svg {...p}>
		<path d="M5 12h13M12.5 6l6 6-6 6" />
	</Svg>
);

export const IconCheck = (p: P) => (
	<Svg {...p}>
		<path d="M5 12.5l4.6 4.6L19 7.6" />
	</Svg>
);

export const IconCross = (p: P) => (
	<Svg {...p}>
		<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
	</Svg>
);

export const IconClock = (p: P) => (
	<Svg {...p}>
		<circle cx="12" cy="13" r="7.6" />
		<path d="M12 9v4.2l2.6 1.7M9.6 2.8h4.8" />
	</Svg>
);

export const IconShield = (p: P) => (
	<Svg {...p}>
		<path
			d="M12 3l7 2.6v5.6c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V5.6z"
			fill="currentColor"
			fillOpacity={0.22}
		/>
	</Svg>
);

export const IconEye = (p: P) => (
	<Svg {...p}>
		<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z" />
		<circle cx="12" cy="12" r="2.8" fill="currentColor" fillOpacity={0.3} />
	</Svg>
);

export const IconSplit = (p: P) => (
	<Svg {...p}>
		<path d="M11 3 4 5v14l5 2 1.6-5L8 12.6l3-3.6-1.6-3z" fill="currentColor" fillOpacity={0.22} />
		<path
			d="M15 3.6 20 5v14l-6.5 2 1.3-5.4-2-3 2.6-3.6-1.4-3z"
			fill="currentColor"
			fillOpacity={0.22}
		/>
	</Svg>
);

export const IconDrop = (p: P) => (
	<Svg {...p}>
		<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
	</Svg>
);

export const IconDashed = (p: P) => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="8" strokeDasharray="3.2 3.2" />
		<path
			d="M12 9.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"
			fill="currentColor"
			stroke="none"
		/>
	</Svg>
);

export const IconInfinity = (p: P) => (
	<Svg {...p}>
		<path d="M7 8.5c-2.2 0-4 1.6-4 3.5s1.8 3.5 4 3.5c4 0 6-7 10-7 2.2 0 4 1.6 4 3.5s-1.8 3.5-4 3.5c-4 0-6-7-10-7z" />
	</Svg>
);

export function ObjectiveIcon({ type, size }: { type: Objective["type"]; size?: number }) {
	switch (type) {
		case "pieces":
			return <IconSplit size={size} />;
		case "clear":
			return <IconDrop size={size} />;
		case "burn":
			return <IconTorch size={size} />;
		case "cutout":
			return <IconDashed size={size} />;
		case "protect":
			return <IconShield size={size} />;
		case "reveal":
			return <IconEye size={size} />;
		case "mend":
			return <IconNeedle size={size} />;
		default:
			return <IconInfinity size={size} />;
	}
}
