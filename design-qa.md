# Locked-reference final correction QA

Source: ../upload/fl new(1).mp4, 750 x 512 pixels, 557 frames at 30 fps. SHA-256 dd2d8f608249600334fe6427a6143932f44605c3a8364d59b77206cc79042b6e. The original remains unaltered.

Implementation: apps/web on feat/locked-video-reproduction. Browser captures: ../faultline-visual-evidence, viewport 750 x 512 CSS pixels, deviceScaleFactor 1. Mobile capture: 360 x 780. Source frames are included at 0, 1.9, 2.8, 5, 8, 11, and 17 seconds. Raw side-by-side comparisons preserve the source framing. Derived normalized comparisons remove filming perspective for application-content inspection; offscreen filmed pixels cannot be recovered.

## Corrections completed

1. Removed the physical monitor, platform, and animated display-plane projection. Filming movement is no longer reproduced as browser-frame movement. A regression test confirms identical application bounds before and after focus.
2. Corrected radial label endpoints and angular spacing to keep both fans within the graph. The keyboard regression measures every focused label's SVG bounds. Source offsets and other provenance records provide actual record density; no fictional workflows or relationships were introduced.
3. Reduced unselected provenance-edge opacity in the overview. Selected policy and execution relations remain clearly distinguished.
4. Added keyboard and pointer relationship inspection. A transitive context path lists its constituent relationships instead of implying an execution gate.
5. Isolated the Playwright local Durable Object store from the interactive preview store to prevent concurrent local sessions sharing SQLite files.

## Functional evidence

17 unit tests passed. 14 deterministic Playwright tests passed on desktop and mobile, with two live Meta tests intentionally skipped. Baseline SAFE_EXECUTION, missing approval UNSAFE_EXECUTION, verified safeguard SAFE_BLOCK, real execution replay, certificate contents and integrity hash, scenario preservation, keyboard controls, reduced-motion interaction, and operation without WebGL passed. No live Meta call was made.

The cloud browser independently completed the same counterfactual and safeguard sequence. Application errors were checked; the cloud extension reported metadata errors outside the application. The automated evidence capture records application page errors separately.

## Fidelity surfaces

- Typography: Arial/Helvetica remains an approximation. The compressed reference does not establish the exact font. Workflow labels replace reference-domain names.
- Spacing/layout: the overview directory and focused analytics retain the measured three-region composition. Both label fans fit inside the graph. The stable app frame intentionally excludes the filmed display and plinth.
- Colors: reference-derived dark surfaces, node colors, cyan focus, and teal chart are retained. Unsafe and verified relationships reflect actual evaluator states.
- Image quality: the app is DOM and live SVG, with no embedded video frames, reference raster assets, monitor rendering, or WebGL requirement.
- Content: ranking, counts, chart values, source offsets, trace, conditions, gates, policies, and outcomes come from validated workflow and simulator records. The sample has fewer domain entities than the reference; provenance records are explicitly typed. Chart shape differs because its values are real Faultline data.

## Remaining differences and acceptance boundary

The original font and exact focused-curve geometry are not independently established. Curved reveal easing and per-node movement follow measured phase boundaries but have not been demonstrated equivalent frame by frame after removal of filming movement. These limitations prevent claiming exact visual and motion reproduction. The comparison package exposes them instead of treating test success as visual acceptance.

Final acceptance remains NO-GO. This is a reviewable draft, not an approved production replacement. Cloudflare CLI authentication is also unavailable, preventing publication and deployed verification of the authorized preview.

final result: blocked
