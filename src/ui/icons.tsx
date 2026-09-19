import type { ToolId } from "@/sim/tools";
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

/** Thicker strokes + bold silhouettes so dock tools read at ~22px. */
function Svg({ size = 24, children, ...rest }: Props & { children: ReactNode }) {
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
		{/* Open palm — fingers + thumb, readable grab cue */}
		<path d="M8 11.5V6.8a1.35 1.35 0 0 1 2.7 0V11" />
		<path d="M10.7 10.8V5.6a1.35 1.35 0 0 1 2.7 0V11" />
		<path d="M13.4 11V6.9a1.35 1.35 0 0 1 2.7 0V12" />
		<path d="M16.1 12.2V9.4a1.35 1.35 0 0 1 2.7 0v5.1a5.4 5.4 0 0 1-5.4 5.4h-.5A5.7 5.7 0 0 1 7.7 15.6L6 12.4A1.7 1.7 0 0 1 8.4 10.5V11" />
	</Svg>
);

export const IconScissors = (p: Props) => (
	<Svg {...p}>
		{/* Classic X-scissors: two rings + crossing blades */}
		<circle cx="6.5" cy="6.5" r="2.6" />
		<circle cx="6.5" cy="17.5" r="2.6" />
		<path d="M9 8.2 20 16.2" />
		<path d="M9 15.8 20 7.8" />
		<path d="M12.2 12h2.2" />
	</Svg>
);

export const IconKnife = (p: Props) => (
	<Svg {...p}>
		{/* Cleaver/knife: long blade + handle block */}
		<path d="M3.8 15.2 15.2 4.6l4.2 4.2-8.8 8.8c-1 .9-2.6.7-3.3-.5L3.8 15.2z" />
		<path d="M15.2 4.6l1.8-1.8a1.6 1.6 0 0 1 2.3 0l1.7 1.7a1.6 1.6 0 0 1 0 2.3l-1.8 1.8" />
		<path d="M5.2 16.4l2.2 2.2" />
	</Svg>
);

export const IconTorch = (p: Props) => (
	<Svg {...p}>
		{/* Lighter body + flame */}
		<path d="M9.2 14.2h5.6v4.2a2.2 2.2 0 0 1-2.2 2.2h-1.2a2.2 2.2 0 0 1-2.2-2.2v-4.2z" />
		<path d="M8.6 14.2c0-2.6 1.5-4.2 3.4-6.2 1.9 2 3.4 3.6 3.4 6.2" />
		<path d="M12 4.8c.4 1.4-.3 2.4-.3 2.4" />
		<path d="M10.2 8.2c.6-.4 1.2-.6 1.8-.6" />
	</Svg>
);

export const IconWater = (p: Props) => (
	<Svg {...p}>
		{/* Fat droplet + inner highlight */}
		<path d="M12 3.8s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z" />
		<path d="M9.6 14.2c.4 1.6 1.6 2.6 3.2 2.6" />
	</Svg>
);

export const IconPin = (p: Props) => (
	<Svg {...p}>
		{/* Pushpin head + needle */}
		<path d="M12 14.8V21" />
		<path d="M8.4 3.5h7.2l-.9 5.6 2.8 2.4v2.2H6.5v-2.2l2.8-2.4-.9-5.6z" />
		<path d="M9.2 3.5h5.6" />
	</Svg>
);

export const IconNeedle = (p: Props) => (
	<Svg {...p}>
		{/* Needle + eye + stitch thread */}
		<path d="M17.2 3.8 5.2 18.6l1.6 1.6L19.4 6" />
		<circle cx="18.6" cy="4.6" r="1.8" />
		<path d="M7.2 16.8c1.4-1 2.2-1.2 3.4-.4" />
	</Svg>
);

export const IconFan = (p: Props) => (
	<Svg {...p}>
		{/* Blower hub + 3 blades + gust */}
		<circle cx="11" cy="12" r="2" />
		<path d="M11 10c2.2-4.2 5.4-5.6 7.6-4.6-1.4 2.4-1.1 5.2-.8 6.4" />
		<path d="M12.6 13c3.4 1.6 4.6 4.2 4 6.4-2.6-.6-4.8-2-5.8-3.6" />
		<path d="M9.4 13c-1.4 3.6-4 5.2-6.4 4.8 1-2.4 2.6-4.2 4-5.2" />
		<path d="M18.5 9.5c1.2.2 2.2.8 2.8 1.6M19 12.2c1.1.4 1.8 1.2 2.2 2.1" />
	</Svg>
);

export const IconRefresh = (p: Props) => (
	<Svg {...p}>
		<path d="M19 12a7 7 0 1 1-2-4.9" />
		<path d="M19 5v5h-5" />
	</Svg>
);

export const IconSpeaker = (p: Props) => (
	<Svg {...p}>
		<path d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5z" />
		<path d="M15 9.2a3.4 3.4 0 0 1 0 5.6" />
		<path d="M17.2 7a6 6 0 0 1 0 10" />
	</Svg>
);

export const IconSpeakerOff = (p: Props) => (
	<Svg {...p}>
		<path d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5z" />
		<path d="M15.5 10.5l4 4M19.5 10.5l-4 4" />
	</Svg>
);

export const IconMore = (p: Props) => (
	<Svg {...p}>
		<circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
		<circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" />
	</Svg>
);

export const IconParty = (p: Props) => (
	<Svg {...p}>
		<path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2" />
		<path d="M7.1 7.1l1.5 1.5M15.4 15.4l1.5 1.5M7.1 16.9l1.5-1.5M15.4 8.6l1.5-1.5" />
		<circle cx="12" cy="12" r="2.4" />
		<circle cx="12" cy="12" r="5.6" />
	</Svg>
);

export const IconLogo = (p: Props) => (
	<Svg {...p}>
		<circle cx="7" cy="7" r="2.3" />
		<circle cx="7" cy="17" r="2.3" />
		<path d="M9 8.4 18.8 16.6M9 15.6 18.8 7.4" />
	</Svg>
);

export const IconSliders = (p: Props) => (
	<Svg {...p}>
		<path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
		<circle cx="16" cy="8" r="2.2" />
		<circle cx="8" cy="16" r="2.2" />
	</Svg>
);

export const IconSlow = (p: Props) => (
	<Svg {...p}>
		<ellipse cx="12" cy="13.5" rx="6.2" ry="4.4" />
		<path d="M8.2 10.2c-.8-2.2.2-4.4 2.4-4.4 1.2 0 1.8.7 2.4 1.6.6-.9 1.2-1.6 2.4-1.6 2.2 0 3.2 2.2 2.4 4.4" />
	</Svg>
);

export function toolIcon(id: ToolId, size = 22) {
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
