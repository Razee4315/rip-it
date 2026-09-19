# RIP IT! brand assets (rip-ui)

## Logo mark
Minimal scissors mark in amber `#e8a13a` on `#0c0e12`.

| File | Use |
|------|-----|
| `logo-mark-1024.svg` | Vector source |
| `logo-1024.png` | **1024×1024** bake input for `tauri icon` + Android adaptive |

### Adaptive icon notes for rip-ci
- Full-bleed dark background (no transparency).
- Mark centered in the **66% safe zone** (important content within ~672px diameter).
- Delete template foreground vectors after bake; copy mipmaps over `gen` res.
- In-app UI mark: `public/assets/icons/logo.svg` + `IconLogo` in `src/ui/icons.tsx`.

## Tokens
`src/theme/tokens.ts` — prototype palette + `touch.minTargetPx: 44` + juice colors.
