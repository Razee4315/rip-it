import type { ToolId } from "@/sim/tools";
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: Props & { children: ReactNode }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
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
		<path d="M8.5 11V7.2a1.2 1.2 0 0 1 2.4 0V11" />
		<path d="M10.9 10.5V6.3a1.2 1.2 0 0 1 2.4 0V11" />
		<path d="M13.3 10.8V7.5a1.2 1.2 0 0 1 2.4 0V12" />
		<path d="M15.7 12V9.2a1.2 1.2 0 0 1 2.4 0v5.3a5.2 5.2 0 0 1-5.2 5.2h-.6a5.5 5.5 0 0 1-5.3-4.1L6.2 12.2A1.6 1.6 0 0 1 8.5 10.6V11" />
	</Svg>
);
export const IconScissors = (p: Props) => (
	<Svg {...p}>
		<circle cx="7" cy="7" r="2.2" />
		<circle cx="7" cy="17" r="2.2" />
		<path d="M9 8.5 19.5 17M9 15.5 19.5 7" />
	</Svg>
);
export const IconKnife = (p: Props) => (
	<Svg {...p}>
		<path d="M4.5 16.5 14 7l3.2 3.2-7.2 7.2c-.8.8-2.2.6-2.8-.3L4.5 16.5z" />
		<path d="M14 7l1.6-1.6a1.4 1.4 0 0 1 2 0L19.2 7a1.4 1.4 0 0 1 0 2L17.5 10.5" />
	</Svg>
);
export const IconTorch = (p: Props) => (
	<Svg {...p}>
		<path d="M10 14h4v3.5a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V14z" />
		<path d="M9.5 14c0-2.2 1.2-3.5 2.5-5.2C13.3 10.5 14.5 11.8 14.5 14" />
		<path d="M12 5.5c.2 1.2-.4 2-.4 2" />
	</Svg>
);
export const IconWater = (p: Props) => (
	<Svg {...p}>
		<path d="M12 4.5s5.5 6.2 5.5 10a5.5 5.5 0 0 1-11 0C6.5 10.7 12 4.5 12 4.5z" />
	</Svg>
);
export const IconPin = (p: Props) => (
	<Svg {...p}>
		<path d="M12 15.5V21" />
		<path d="M9.2 3.8h5.6l-.7 5.2 2.4 2.2v1.8H7.5v-1.8l2.4-2.2-.7-5.2z" />
	</Svg>
);
export const IconNeedle = (p: Props) => (
	<Svg {...p}>
		<path d="M16.5 4.5 6 18.5l1.2 1.2L18.8 6.8" />
		<circle cx="18.2" cy="5.2" r="1.5" />
	</Svg>
);
export const IconFan = (p: Props) => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="1.6" />
		<path d="M12 10.4c1.8-3.6 4.6-4.8 6.6-4.2-1.2 2.2-1 4.6-.8 5.8" />
		<path d="M13.4 12.8c3.2 1.4 4.2 3.8 3.8 5.8-2.4-.6-4.4-1.8-5.4-3.2" />
		<path d="M10.6 12.8c-1.2 3.4-3.6 4.8-5.8 4.6.8-2.3 2.2-4 3.6-5" />
		<path d="M10.4 11.2C8 8.8 6.2 6.8 6 4.8c2.3.3 4.4 1.6 5.4 3.4" />
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
		<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
		<circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
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
		<circle cx="7" cy="7" r="2.1" />
		<circle cx="7" cy="17" r="2.1" />
		<path d="M9 8.4 18.8 16.6M9 15.6 18.8 7.4" />
	</Svg>
);
export const IconSliders = (p: Props) => (
	<Svg {...p}>
		<path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
		<circle cx="16" cy="8" r="2" />
		<circle cx="8" cy="16" r="2" />
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
