export const APP_NAME = import.meta.env.VITE_APP_NAME || "RIP IT!";

export const isTauriEnvironment =
	typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
