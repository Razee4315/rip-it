# Changelog

## 1.2.0 — 2026-10-06

- Fix objective text overlapping progress. Frame the cloth using measured HUD and tool-dock bounds, including narrow and landscape screens.
- Simplify the home screen and pause menu. Group settings into Play, Audio, and Graphics; return to pause after changing settings.
- Add persistent tool guidance, disabled exhausted tools, safe scrolling for short screens, keyboard focus containment, and a startup status.
- Remove the washing-line fabric's preloaded fold so fresh towels hang evenly. Preserve calm startup and uninterrupted tearing.
- Replace oversized tear fibers with smaller, curved, fabric-tinted threads that fall and fade quickly. Cap tear/cut debris per frame by graphics quality.
- Add master volume, independent ambience, and optional soft procedural music (off by default). Lower background noise, disconnect finished audio nodes, and resume sound after backgrounding.
- Preserve existing saves and validate new audio preferences. Add dense-debris and audio lifecycle regression tests.
- Label the Android release correctly as arm64; remove the duplicate APK previously labeled universal.

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
