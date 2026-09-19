# RIP IT!

Cloth-tearing satisfaction playground — **Tauri 2 + React + TypeScript**.

Tear silk, denim, paper, chainmail and more with Hand, Scissors, Torch, Water, and overflow tools. Desktop and Android share one codebase (split presentation only).

## Local development

```bash
npm install
npm run dev          # Vite at http://localhost:1420
npm run tauri dev    # native desktop window (requires Rust + Tauri deps)
```

### Scripts

| Command | What |
|---------|------|
| `npm run dev` | Vite web playground |
| `npm run build` | `tsc && vite build` |
| `npm run test` | Vitest |
| `npm run lint` | Biome |
| `npm run tauri` | Tauri CLI |
| `npx tauri dev` | Desktop shell |

## Android

**Android builds run in CI only** — do not run `tauri android build` on a slow local machine.

- `npx tauri android init` once in CI (or when gen/ is needed)
- Release APK via GitHub Actions (rip-ci)

## Stack

- Tauri 2 · React 18 · Vite 5 · TypeScript · styled-components · Tailwind 3 · Biome
- Cloth sim: Verlet constraints (tear / burn / wet / cut / sew)

## Repo layout

```
src/sim      cloth physics
src/audio    shared AudioContext + SFX
src/ui       dock, sheet, canvas shell
src/theme    design tokens
src-tauri/   Rust host (lib.rs mobile entry)
```

## License

MIT
