import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
	readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
);
const host = process.env.TAURI_DEV_HOST || "localhost";

export default defineConfig((): UserConfig => {
	return {
		plugins: [react()],
		define: {
			"import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
		},
		clearScreen: false,
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			port: 1420,
			strictPort: true,
			host: "0.0.0.0",
			hmr: { protocol: "ws", host, port: 1421 },
			watch: { ignored: ["**/src-tauri/**"] },
		},
		build: {
			// WebGL2 + modern syntax: every WebView that can run the game supports this
			target: "es2020",
			minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
			sourcemap: !!process.env.TAURI_DEBUG,
			chunkSizeWarningLimit: 900,
		},
		test: {
			globals: true,
			environment: "node",
		},
	};
});
