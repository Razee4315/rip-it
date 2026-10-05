import { useEffect } from "react";

/** Keep keyboard focus and pointer interaction inside the active modal. */
export function useDialog(key: string | null) {
	useEffect(() => {
		if (!key) return;
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
		if (!dialog) return;
		const previous = document.activeElement;
		const inert: [HTMLElement, boolean][] = [];
		let child: HTMLElement = dialog;
		while (child.parentElement && !child.classList.contains("app")) {
			for (const sibling of child.parentElement.children) {
				if (sibling !== child && sibling instanceof HTMLElement) {
					inert.push([sibling, sibling.inert]);
					sibling.inert = true;
				}
			}
			child = child.parentElement;
		}
		const focusable = () =>
			Array.from(
				dialog.querySelectorAll<HTMLElement>(
					'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
				),
			).filter((el) => el.getClientRects().length > 0);
		// The sheet enters from below the viewport. Focusing during that animation
		// must not scroll the clipped game layer and move the canvas under the HUD.
		(focusable()[0] ?? dialog).focus({ preventScroll: true });
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const items = focusable();
			if (!items.length) {
				e.preventDefault();
				return;
			}
			const first = items[0],
				last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			for (const [el, value] of inert) el.inert = value;
			if (previous instanceof HTMLElement && previous.isConnected)
				previous.focus({ preventScroll: true });
		};
	}, [key]);
}
