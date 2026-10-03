/** Small persistent key/value store: Tauri's store plugin in the app, localStorage on the web. */

function inTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const FILE = "rip-it.json";

export async function loadKey<T>(key: string): Promise<T | null> {
	try {
		if (inTauri()) {
			const { Store } = await import("@tauri-apps/plugin-store");
			const store = await Store.load(FILE);
			const v = await store.get<T>(key);
			if (v !== undefined && v !== null) return v;
		}
	} catch {
		/* fall through to localStorage */
	}
	try {
		const raw = localStorage.getItem(`rip-it:${key}`);
		if (raw) return JSON.parse(raw) as T;
	} catch {
		/* unavailable or corrupt */
	}
	return null;
}

export async function saveKey<T>(key: string, value: T): Promise<void> {
	try {
		localStorage.setItem(`rip-it:${key}`, JSON.stringify(value));
	} catch {
		/* private mode, quota… */
	}
	try {
		if (inTauri()) {
			const { Store } = await import("@tauri-apps/plugin-store");
			const store = await Store.load(FILE);
			await store.set(key, value);
			await store.save();
		}
	} catch {
		/* localStorage copy above still holds it */
	}
}
