# v1.3.0 validation

Validation date: 2026-10-06. All versions in npm, Cargo, their lockfiles, and Tauri are 1.3.0.

## Automated checks

- `npm run lint`: passed, 43 source files.
- `npm test`: passed, 70 tests in four suites.
- `npm run build`: passed TypeScript and Vite; main JavaScript bundle 346.12 kB, 115.43 kB gzip.
- `npm audit --omit=dev`: zero reported vulnerabilities in shipping JavaScript dependencies.
- `git diff --check`: passed.
- Tauri icon generation from the existing vector source: passed; Windows and adaptive Android assets generated. The 128px icon was visually inspected.

New regressions cover local cutting near stressed remote mounts across all ten fabrics, exact hem crossings and dense strip cuts, closed loops, coalesced pointer positions, release-only endpoints, duplicate touch samples, fractional torch fuel, empty-space firecracker taps, stable winning scores, impossible piece-count retries, paused particle lifetimes, orientation-independent soaking, and malformed saves.

## Campaign engine sweep

[`browser-campaign-qa.js`](../scripts/browser-campaign-qa.js) was evaluated in the running development browser. It uses the real mesh, projection, simulation, topology, and objective evaluator. It suppresses completion callbacks so it does not award test stars or change saved progress.

All 24 campaign levels reached `done` at both 375×667 and 1280×800: **48/48 completed**, all coordinates finite, all recorded cut and fuel budgets respected, all timed goals met. See [raw results](qa-v1.3.0.json).

The harness invokes engine tools directly with repeatable paths. Cut, heat, sewing, and soaking application time is not a full UI gesture measurement; its clock values must not be used to claim human completion times or three-star speed performance. Fuel doses are converted to their tool allowance, and a separate Game regression checks actual held-tool spending. This sweep demonstrates reachable objectives and stable simulation, alongside the pointer checks below.

## Browser UI and production smoke checks

- Production build served by `vite preview` loaded as v1.3.0. Local fonts and bundled assets loaded; the WebGL error flag remained zero during inspected play.
- 320×568, 375×667, 667×375, and 1280×800 layouts inspected. Tool targets fit on the narrow phone viewport, and short landscape dialogs scroll inside the screen.
- All ten fabrics, six mounts, five environments, eight dyes, and nine tools selected correctly in Free Play.
- Play, Audio, and Graphics switches changed and restored their state. Low, Medium, High, and Auto selections responded correctly.
- Dialog opening and closing kept the canvas at y=0. Keyboard Shift+Tab wrapped inside the pause dialog; Escape paused play.
- Production Start → touch scissor stroke → result → Next flow passed. A single touch stroke cut Snip Snip down, earned three stars, showed 100%, and generated zero spontaneous tears. Restart reset the previous stroke.
- Result particles fell and expired behind the dialog; the winning readout remained 100% after settling. Intro and next-level text reflected the correct level.

## Technical references

Input handling follows actual event timestamps and [coalesced PointerEvent samples](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents), preserving the final release position. The [Pointer Events specification](https://www.w3.org/TR/pointerevents/) provides the underlying event model. Environment transitions now use ordered edges because [Khronos specifies undefined smoothstep results when edge0 is greater than or equal to edge1](https://github.com/KhronosGroup/OpenGL-Refpages/blob/main/gl4/smoothstep.xml).

## Packaging and limits

Windows installers and the signed arm64 Android APK are built from the release commit/tag by GitHub Actions. Native Rust is unavailable in the local environment, so native compilation is verified in CI. Physical Android hardware, device-specific GPU behavior, and installation on a physical handset have not been tested here. The browser phone checks use resized viewports and touch PointerEvents; they are not a device benchmark.
