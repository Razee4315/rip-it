/** Detect touch/mobile shell once at boot. Prefer UA + coarse pointer over width. */
export function detectTouchShell(): boolean {
	if (typeof window === "undefined") return false;
	const params = new URLSearchParams(window.location.search);
	if (params.get("mobile") === "1") return true;
	if (params.get("mobile") === "0") return false;
	const coarse =
		typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
	const ua = navigator.userAgent || "";
	const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
	return coarse || mobileUa;
}

export function applyTouchClass(isTouch: boolean) {
	document.documentElement.classList.toggle("touch", isTouch);
}
