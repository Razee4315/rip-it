import type { ToolId } from "@/sim/tools";
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/** Filled high-contrast silhouettes for dock (rip-game). */
function Svg({ size = 26, children, ...rest }: Props & { children: ReactNode }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="currentColor"
			stroke="none"
			aria-hidden="true"
			{...rest}
		>
			{children}
		</svg>
	);
}

/** Outline helper for non-tool chrome icons */
function StrokeSvg({ size = 24, children, ...rest }: Props & { children: ReactNode }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...rest}
		>
			{children}
		</svg>
	);
}

export const IconHand = (p: Props) => (
	<Svg {...p}>
		<path d="M8.2 11.2V7.1c0-.85.7-1.55 1.55-1.55S11.3 6.25 11.3 7.1v3.4h1.15V5.85c0-.85.7-1.55 1.55-1.55s1.55.7 1.55 1.55V11h1.1V7.6c0-.85.7-1.55 1.55-1.55s1.55.7 1.55 1.55v6.4c0 3.05-2.35 5.55-5.35 5.55h-.55c-2.85 0-5.2-2.05-5.7-4.8L7.05 12.4A1.75 1.75 0 0 1 8.85 10.3c.45 0 .88.16 1.22.45l.13.12V11.2H8.2z" />
	</Svg>
);

export const IconScissors = (p: Props) => (
	<Svg {...p}>
		{/* Open blades X + ring pivots */}
		<path d="M8.4 9.1 19.6 17.2l-1.35 1.85L7.05 10.95z" />
		<path d="M8.4 14.9 19.6 6.8l-1.35-1.85L7.05 13.05z" />
		<circle cx="6.2" cy="6.4" r="2.55" />
		<circle cx="6.2" cy="17.6" r="2.55" />
		<circle cx="6.2" cy="6.4" r="1" fill="#0c0e12" />
		<circle cx="6.2" cy="17.6" r="1" fill="#0c0e12" />
	</Svg>
);

export const IconKnife = (p: Props) => (
	<Svg {...p}>
		<path d="M3.6 15.4 14.8 4.2c.55-.55 1.45-.55 2 0l3 3c.55.55.55 1.45 0 2L8.6 20.4c-.85.85-2.2.7-2.85-.35L3.6 15.4z" />
		<path
			d="M14.9 4.3l1.5-1.5a1.7 1.7 0 0 1 2.4 0l1.5 1.5a1.7 1.7 0 0 1 0 2.4l-1.5 1.5-3.9-3.9z"
			opacity="0.92"
		/>
	</Svg>
);

export const IconTorch = (p: Props) => (
	<Svg {...p}>
		{/* Nozzle / body */}
		<path d="M9 14.2h6v4.4a2.4 2.4 0 0 1-2.4 2.4h-1.2A2.4 2.4 0 0 1 9 18.6v-4.4z" />
		{/* Flame */}
		<path d="M12 3.6c2.8 2.6 4.6 4.8 4.6 7.6 0 1.55-.7 2.85-1.85 3.55H9.25C8.1 14.05 7.4 12.75 7.4 11.2c0-2.8 1.8-5 4.6-7.6z" />
		<path
			d="M12 7.2c1.1 1.1 1.7 2 1.7 3.1 0 .7-.35 1.25-.85 1.55h-1.7c-.5-.3-.85-.85-.85-1.55 0-1.1.6-2 1.7-3.1z"
			fill="#0c0e12"
			opacity="0.35"
		/>
	</Svg>
);

export const IconWater = (p: Props) => (
	<Svg {...p}>
		<path d="M12 2.8s6.4 7.2 6.4 11.6A6.4 6.4 0 0 1 12 20.8a6.4 6.4 0 0 1-6.4-6.4C5.6 10 12 2.8 12 2.8z" />
		<path
			d="M9.8 13.6c.45 1.9 1.9 3.1 3.7 3.1"
			fill="none"
			stroke="#0c0e12"
			strokeWidth="1.6"
			strokeLinecap="round"
			opacity="0.35"
		/>
	</Svg>
);

export const IconPin = (p: Props) => (
	<Svg {...p}>
		<path d="M11.15 14.6h1.7V21h-1.7z" />
		<path d="M7.6 3.2h8.8l-1.05 6.2 3.05 2.55v2.65H5.6v-2.65L8.65 9.4 7.6 3.2z" />
	</Svg>
);

export const IconNeedle = (p: Props) => (
	<Svg {...p}>
		<path d="M16.8 2.9 4.6 18.2l2.1 2.1L19 5.1z" />
		<circle cx="18.3" cy="4.1" r="2.1" />
		<circle cx="18.3" cy="4.1" r="0.85" fill="#0c0e12" />
	</Svg>
);

export const IconFan = (p: Props) => (
	<Svg {...p}>
		<circle cx="10.5" cy="12" r="2.2" />
		<path d="M10.5 9.4c2.4-4.6 6-6.1 8.5-4.8-1.6 2.8-1.2 5.8-.7 7.1L10.5 9.4z" />
		<path d="M12.4 13.2c3.8 1.8 5.2 4.8 4.4 7.2-3-.8-5.4-2.4-6.5-4.2l2.1-3z" />
		<path d="M8.6 13.1C7 17.2 4 19 1.4 18.4c1.1-2.8 2.9-4.8 4.6-5.9l2.6.6z" />
		{/* Gust ticks */}
		<path
			d="M18.2 9.2h3.2M18.8 12h3.6M18.2 14.8h2.8"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		/>
	</Svg>
);

export const IconRefresh = (p: Props) => (
	<StrokeSvg {...p}>
		<path d="M19 12a7 7 0 1 1-2-4.9" />
		<path d="M19 5v5h-5" />
	</StrokeSvg>
);

export const IconSpeaker = (p: Props) => (
	<StrokeSvg {...p}>
		<path d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5z" />
		<path d="M15 9.2a3.4 3.4 0 0 1 0 5.6" />
		<path d="M17.2 7a6 6 0 0 1 0 10" />
	</StrokeSvg>
);

export const IconSpeakerOff = (p: Props) => (
	<StrokeSvg {...p}>
		<path d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5z" />
		<path d="M15.5 10.5l4 4M19.5 10.5l-4 4" />
	</StrokeSvg>
);

export const IconMore = (p: Props) => (
	<Svg {...p}>
		<circle cx="5" cy="12" r="2.1" />
		<circle cx="12" cy="12" r="2.1" />
		<circle cx="19" cy="12" r="2.1" />
	</Svg>
);

export const IconParty = (p: Props) => (
	<StrokeSvg {...p}>
		<path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2" />
		<path d="M7.1 7.1l1.5 1.5M15.4 15.4l1.5 1.5M7.1 16.9l1.5-1.5M15.4 8.6l1.5-1.5" />
		<circle cx="12" cy="12" r="2.4" />
		<circle cx="12" cy="12" r="5.6" />
	</StrokeSvg>
);

export const IconLogo = (p: Props) => (
	<StrokeSvg {...p}>
		<circle cx="7" cy="7" r="2.3" />
		<circle cx="7" cy="17" r="2.3" />
		<path d="M9 8.4 18.8 16.6M9 15.6 18.8 7.4" />
	</StrokeSvg>
);

export const IconSliders = (p: Props) => (
	<StrokeSvg {...p}>
		<path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
		<circle cx="16" cy="8" r="2.2" />
		<circle cx="8" cy="16" r="2.2" />
	</StrokeSvg>
);

export const IconSlow = (p: Props) => (
	<StrokeSvg {...p}>
		<ellipse cx="12" cy="13.5" rx="6.2" ry="4.4" />
		<path d="M8.2 10.2c-.8-2.2.2-4.4 2.4-4.4 1.2 0 1.8.7 2.4 1.6.6-.9 1.2-1.6 2.4-1.6 2.2 0 3.2 2.2 2.4 4.4" />
	</StrokeSvg>
);

export function toolIcon(id: ToolId, size = 26) {
	switch (id) {
		case "hand":
			return <IconHand size={size} />;
		case "scissors":
			return <IconScissors size={size} />;
		case "knife":
			return <IconKnife size={size} />;
		case "torch":
			return <IconTorch size={size} />;
		case "water":
			return <IconWater size={size} />;
		case "pin":
			return <IconPin size={size} />;
		case "needle":
			return <IconNeedle size={size} />;
		case "fan":
			return <IconFan size={size} />;
	}
}
