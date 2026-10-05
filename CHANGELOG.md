# Changelog

## 1.1.1 — 2026-10-05

- Fix bending corrections injecting energy into untouched cloth even with wind off.
- Settle fresh cloth in still air and keep it at rest until a tool or world control is used.
- Start every level, restart, and sandbox preset with zero wind, including flags. Wind is opt-in through sandbox controls.
- Improve settling so cloth reaches its hanging shape before play.
- Remove automatic tear camera shake and simulation freezes. Slow motion remains an explicit sandbox option.
- Add regression checks for motionless startup, stable bending, wind opt-in, and uninterrupted frames during repeated tears.

## 1.1.0 — 2026-10-05

- Grabbing and small hand movements no longer start tears. Pull deliberately to rip; optional Gentle controls give more room before tearing.
- Calmer wind in every environment, a gentler flag preset, stronger motion damping, and truly still air at zero wind.
- Preserve the cloth and level progress when rotating or resizing the screen.
- Pause simulation behind menus, briefings, and sandbox settings. Release tools on backgrounding, lost pointer capture, and pause; canceled scissors no longer snip.
- Add reduced camera shake/full-screen flashes, reset settings, explanations, and compatibility with existing saved preferences.
- Reduce cloth cell count by about 27% at the same physical size; bake fabric textures on demand and cap active rendering at 60 fps.
- Ignore obsolete scene transitions when switching settings quickly.
- Add physics, control, and save compatibility regression coverage, including completion of the opening towel objective.
- Validate frontend checks before release builds and build Android from the requested release tag.
