# RIP IT! brand assets

## App icon

`icon.svg` is the single source for every icon size. A square of red cloth ripped down the middle, with light breaking through the tear.

- Full-bleed dark background, no transparency.
- Everything that matters sits inside the central 66% (Android adaptive safe zone).
- Shapes, gradients and blurs only. No text and no fonts, so it renders the same everywhere.

Generate the platform icons from it:

```bash
npx tauri icon design/icon.svg --output src-tauri/icons
```

The release workflows run this themselves. `public/icon.svg` is a copy used as the web favicon; keep the two in sync.

## Colour

| Token | Hex | Use |
|-------|-----|-----|
| Ink | `#0b0a0d` | Background, launcher background |
| Cream | `#f6efe2` | Text |
| Signal red | `#ff4a2b` | Primary actions, the selected tool |
| Ember | `#ff8a3c` | Progress, heat |
| Gold | `#ffc24b` | Stars |

The tokens live at the top of `src/styles/app.css`.

## Type

- **Anton** for the wordmark, headings and numbers. Always uppercase.
- **Outfit** for everything else.

Both are bundled with the app (`@fontsource`), so nothing is fetched at runtime.

## Motifs

- The wordmark is torn across the middle (two clipped halves, slightly offset).
- Buttons and cards carry a dashed line just inside their edge, like stitching on a sewn-on patch.
