/** Light haptic feedback via the Vibration API — no-op on desktop / unsupported WebViews. */
export function haptic(pattern: number | number[]) {
	try {
		if (typeof navigator !== "undefined" && "vibrate" in navigator) {
			navigator.vibrate(pattern);
		}
	} catch {
		/* ignore */
	}
}
