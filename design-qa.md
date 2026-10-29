# Locked-reference visual QA

Source: supplied fl new(1).mp4, 750 x 512, 557 frames at 30 fps.
Implementation: apps/web, branch feat/locked-video-reproduction.
Comparison viewport: 750 x 512 CSS pixels, device scale factor 1.

Functional verification covers record selection, filtering, heatmap, zoom, radial formation, analytics expansion and contraction, measured camera cuts, return movement, source editing, deterministic counterfactuals, safeguards, replay, and certificate export. Live Meta calls remain disabled during this verification. Existing Meta backend logic is preserved.

Comparison evidence is captured in faultline-visual-evidence: overview, focus, expanded analytics, distant return, final transition, unsafe and safeguarded states, and a real browser motion recording. Earlier cloud-browser checks also confirmed the real SAFE_BLOCK result; only browser-extension metadata errors appeared in that browser's error log. Automated capture reports application page errors separately.

Iteration history:
1. Corrected the estimated camera rotations using screen-corner projection.
2. Corrected ranking and analytics panels to span the filter/context row.
3. Adjusted optical text sizes, focused graph placement, and the presentation surround.
4. Replaced generic overview placement with circle coordinates measured from the reference. Labels and edges remain actual Faultline records.

Fonts and typography: Arial/Helvetica approximates the compressed reference. Exact source font identity is unverified.
Spacing and layout: major panel proportions and camera cut times are implemented. Some focused label spacing and scene framing still differ.
Colors: reference-derived dark surfaces and colored node groups are implemented.
Image quality: the interface uses live SVG and DOM, not embedded frames. The physical monitor/platform surround is reconstructed and differs from the original scene's lighting and geometry.
Copy and data: genuine workflow and evidence records replace the reference domain. Charts show actual link degrees, so their shape differs from the source data.

Remaining findings:
- P2: the reconstructed presentation surround does not achieve exact visual parity with the original environment.
- P2: focused label placement and network density are not an exact reproduction across every frame.
- Source font identification and original scene materials remain unverified.

These findings prevent claiming exact visual acceptance. Keep the replacement isolated and do not merge or deploy over the public application.

final result: blocked
