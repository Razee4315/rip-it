# Changelog

## 1.3.0 — 2026-10-06

- Keep fractures local to a pull, burn, blast, or existing rip. Cutting the side of the cloth no longer lets a stressed distant peg start an unrelated tear.
- Keep continuous cuts connected across split mesh vertices, close cutout loops, and handle precise hem crossings. A scissor notch now helps a later hand pull start at its tip.
- Follow coalesced touch samples and the release endpoint. Repeated samples no longer slow the blade, and empty-space firecracker taps preserve their allowance.
- Make Wet Blanket's soaked band consistent across orientations; keep the winning score stable while scraps settle. Offer a retry when scraps become too small to meet a piece-count goal, and clamp the last fraction of held-tool fuel.
- Label every tool, fabric, and dye clearly. Show the current level or fabric above the objective, show piece counts in Free Play, and prevent dialog focus from scrolling the canvas away from the controls.
- Refine weave highlights and environment shader transitions. Use smaller, gentler celebrations that respect graphics quality and reduced-motion settings, and let particles finish falling behind result cards.
- Compose distinct, quiet musical phrases for each environment, with rests and slower bass changes. Music remains optional and off by default.
- Preserve valid progress when another saved field is malformed. Expand regression coverage to 70 tests and add a reproducible 48-scenario campaign engine check.

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
