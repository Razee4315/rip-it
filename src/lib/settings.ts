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
	gravity: 1,
	matId: "silk",
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
