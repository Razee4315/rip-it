/** Settings via Tauri plugin-store when available, else localStorage. */

export type RipSettings = {
	muted: boolean;
	wind: number;
	gravity: number;
	matId: string;
	tool: string;
};

const KEY = "rip-it-settings";
const DEFAULTS: RipSettings = {
	muted: false,
	wind: 0.12,
	// gentle — the cloth should float and sag, not slam
	gravity: 0.8,
	// cotton, like the original prototype — silk can't hold its own weight at spawn
	matId: "cotton",
	tool: "hand",
};

function isTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadSettings(): Promise<RipSettings> {
	try {
		if (isTauri()) {
			const { Store } = await import("@tauri-apps/plugin-store");
			const store = await Store.load("settings.json");
			const saved = await store.get<Partial<RipSettings>>("prefs");
			return { ...DEFAULTS, ...saved };
		}
	} catch {
		/* fall through */
	}
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		/* */
	}
	return { ...DEFAULTS };
}

export async function saveSettings(prefs: RipSettings): Promise<void> {
	try {
		if (isTauri()) {
			const { Store } = await import("@tauri-apps/plugin-store");
			const store = await Store.load("settings.json");
			await store.set("prefs", prefs);
			await store.save();
			return;
		}
	} catch {
		/* fall through */
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {
		/* */
	}
}

export { DEFAULTS as defaultSettings };
