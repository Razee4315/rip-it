/**
 * RIP IT! design tokens — dark playful game chrome.
 * Palette locked to prototype CSS vars (--bg / --acc / --acc2).
 */
export const tokens = {
	colors: {
		primary: "#e8a13a",
		secondary: "#ff5d47",
		accent: "#e8a13a",
		background: {
			darkest: "#0c0e12",
			darker: "#0d0f14",
			dark: "#13161c",
			light: "#161a22",
		},
		text: {
			primary: "#d8dce3",
			secondary: "#8b93a2",
			tertiary: "#69707e",
			disabled: "#4B5563",
			onAccent: "#1a1206",
		},
		success: "#3ecf8e",
		error: "#EF4444",
		warning: "#e8a13a",
		info: "#459FB9",
		surface: {
			base: "#13161c",
			elevated: "#161a22",
			overlay: "rgba(255, 255, 255, 0.045)",
			overlayHover: "rgba(255, 255, 255, 0.08)",
			overlayActive: "rgba(232, 161, 58, 0.12)",
			subtle: "rgba(255, 255, 255, 0.02)",
		},
		border: {
			default: "rgba(255, 255, 255, 0.08)",
			subtle: "rgba(255, 255, 255, 0.06)",
			hover: "rgba(255, 255, 255, 0.15)",
			focus: "#e8a13a",
			error: "#EF4444",
			party: "rgba(232, 161, 58, 0.35)",
		},
		juice: {
			tear: "#e8a13a",
			burn: "#ff5d47",
			ember: "#ffb347",
			wet: "#4a9eff",
			shred: "#ff5d47",
		},
		overlay: "rgba(8, 9, 12, 0.55)",
		backdrop: "rgba(12, 14, 18, 0.95)",
	},
	typography: {
		fontFamily: {
			primary: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
			heading: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
			monospace: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
		},
		fontSize: {
			xs: "0.75rem",
			sm: "0.875rem",
			base: "1rem",
			lg: "1.125rem",
			xl: "1.25rem",
			"2xl": "1.5rem",
			"3xl": "1.875rem",
		},
		fontWeight: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
		lineHeight: { tight: 1.25, normal: 1.4, relaxed: 1.75 },
	},
	spacing: { xs: "0.25rem", sm: "0.5rem", md: "1rem", lg: "1.5rem", xl: "2rem" },
	borderRadius: { sm: "0.25rem", md: "0.5rem", lg: "0.75rem", xl: "1rem", full: "9999px" },
	shadows: {
		none: "none",
		sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
		md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
		lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
		card: "0 18px 60px rgba(0, 0, 0, 0.6)",
		glow: {
			primary: "0 0 28px rgba(232, 161, 58, 0.12)",
			burn: "0 0 24px rgba(255, 93, 71, 0.35)",
		},
	},
	transitions: { fast: "150ms ease-in-out", normal: "250ms ease-in-out" },
	touch: {
		/** AC-09: every interactive control ≥44×44 CSS px on touch */
		minTargetPx: 44,
		dockBtnPx: 48,
	},
	zIndex: { base: 0, dock: 100, sheet: 200, modal: 300, toast: 400 },
	breakpoints: { mobile: 640, tablet: 1024, desktop: 1280 },
	layout: {
		asideWidthPx: 256,
		safeAreaPadding: true,
	},
} as const;

export type Tokens = typeof tokens;
