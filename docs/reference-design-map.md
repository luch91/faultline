# Reference design mapping

Source: 55 owner supplied PNG frames in `faultline_exact_video_frames` and the original `design%20fl(1).mp4`. These files are comparison material only and are not bundled in the application.

## Frame breakdown

| Frames | Visible composition and motion | Faultline mapping |
| --- | --- | --- |
| 001-004 | High, oblique map view with dense blue, amber, and violet site markers; narrow navigation and floating data. | Workflow topology overview with actual condition and step markers. |
| 005-007 | Camera descends toward a small, structured installation at the edge of an abstract city. | Camera focuses on the selected workflow's execution group. |
| 008-011 | Selected installation gains an amber locator, curved approach line, and compact contextual reading. | Selected investigation and its evaluated outcome. |
| 012 | Scene dissolves into a dark technical grid. | Transition into the execution group. |
| 013 | Repeated angled supports assemble in regular rows. | Workflow modules enter the lattice at fixed coordinates. |
| 014-016 | Dense three-row panel array appears; thin illuminated blue routes form below it. | Repeated execution lattice with graph-derived dependency paths. |
| 017-020 | Camera settles above the array; inverter sits upper left; compact left diagnostics and lower timeline enter. | Selected workflow step, source diagnostics, simulator trace. |
| 021-024 | Abnormal module is marked red; a contextual warning card appears over the right of the array. | Evaluator's first violation and safeguard action. |
| 025-027 | Array remains dominant as camera begins to retreat; state and left diagnostics persist. | Keep selected module and result while returning to overview. |
| 028-031 | Wide overview with left operational sidebar and a right item list. | Workflow list, policy and execution summary. |
| 032-035 | Oblique camera glides across a dark geometric city toward another small installation. | Move between workflow topology and execution group. |
| 036-039 | Amber locator and a single curved connection focus on a second installation. | Focus selected intervention or repair. |
| 040-044 | Installation supports and three-row array reappear in a staged reveal. | Re-enter lattice for counterfactual and safeguard states. |
| 045-049 | Close diagnostic view exposes blue routes, module readings, warning marker, and compact analysis. | Outcome comparison with actual simulator values and source evidence. |
| 050-054 | Full operational workspace with left analysis, center-right array, lower event plot, and floating action card. | Main investigation workspace and verified safeguard control. |
| 055 | Camera returns to wide topology overview, preserving side navigation and selection context. | Overview navigation with retained investigation state. |

## Individual frame index

| Frame | Visible state |
| --- | --- |
| 001 | Wide dark topology and site markers |
| 002 | Map markers and tags |
| 003 | Wide topology and context |
| 004 | Overview framed by two side panels |
| 005 | Approach toward installation |
| 006 | Approach over dark city |
| 007 | Installation becomes focus |
| 008 | Installation receives focus marker |
| 009 | Amber target and route appear |
| 010 | Amber locator expands |
| 011 | Selected locator brightens |
| 012 | Dark grid transition |
| 013 | Repeated supports assemble |
| 014 | Angled modular field forms |
| 015 | Blue routes appear |
| 016 | Modular installation completes |
| 017 | Operational panel enters |
| 018 | Oblique array and equipment |
| 019 | Diagnostic context grows |
| 020 | Operational composition settles |
| 021 | Abnormal element highlighted |
| 022 | Contextual warning card appears |
| 023 | Warning card remains |
| 024 | Problem state stays visible |
| 025 | Array and diagnostics persist |
| 026 | Camera retreats |
| 027 | Return toward overview |
| 028 | Map overview and item list |
| 029 | Map markers and list |
| 030 | Map selection moves |
| 031 | Map selection continues |
| 032 | Camera transit over terrain |
| 033 | City and small installation |
| 034 | Installation centers |
| 035 | Focus cursor enters |
| 036 | Route ignites |
| 037 | Amber locator and route |
| 038 | Locator and reading |
| 039 | Installation stays in focus |
| 040 | Support posts emerge |
| 041 | First row and supports |
| 042 | Angled rows assemble |
| 043 | Bright array and blue routes |
| 044 | Module readings appear |
| 045 | Diagnostic workspace re-enters |
| 046 | Equipment and analysis |
| 047 | Trend and cable detail |
| 048 | Full workspace with warning |
| 049 | Warning and diagnostic change |
| 050 | Contextual repair card |
| 051 | Repair card and path |
| 052 | Card clears |
| 053 | Stable installation view |
| 054 | Workspace recedes |
| 055 | Wide topology returns |

## Components and tokens

- A compact left navigation rail, a dark diagnostic column, a dominant spatial scene, a selected-object card, a low event strip, and small lower-right actions.
- Backgrounds range from nearly black navy to muted blue. Connections are electric blue. Teal indicates satisfied, coral indicates a violated rule, amber indicates unknown or focus. Borders remain thin and panels translucent.
- Typography is compact and technical. IBM Plex Sans and IBM Plex Mono are used with local fallbacks. Large marketing headlines have no place in this layout.
- The camera uses a high oblique overview and a lower, closer view of the angled array. Movement eases between fixed targets and can be interrupted. Reduced motion switches immediately.

## Domain substitution

| Reference object | Faultline object |
| --- | --- |
| Solar panels | Repeated execution modules for actual conditions and workflow steps |
| Inverter | Selected automation step or deployment agent |
| Blue power cables | Declared dependencies and execution gates, with a distinct violet policy route |
| Production reading | Evaluated policy and execution outcome |
| Underperforming panel | Violated requirement or unsafe execution path |
| Repair card | Simulator-tested safeguard |
| Trend analysis | Recorded investigation and execution events |
| Site map | Abstract workflow topology with no geographical claim |

## Integration and rights

The scene consumes the existing `Workflow`, `EvaluationResult`, and intervention state. It cannot calculate or override simulator outcomes. The existing intake, extraction, editing, intervention, investigation, safeguard, replay, and export APIs remain in use. A static 2D node list supports small screens and WebGL failure.

The reference contains FuseLab Creative branding and likely proprietary artwork. No frame, watermark, logo, photograph, model, texture, or source asset is redistributed. Geometry, layout, and styling are recreated in code. Three.js and React Three Fiber are MIT licensed dependencies.

## Current preview differences

- The overview shows the actual workflow entities and dependencies around the installation. It does not yet reproduce the reference's dense map and city traversal.
- The sample workflow has four real entities, so the lattice has four labeled housings. Their distinct mechanisms represent test execution, human approval, migration verification, and deployment control. The reference contains a denser physical array. No extra workflow entities are invented to fill it.
- The preview uses compact state rows in place of the reference's continuous trend plot. Those rows are derived from the baseline, counterfactual, and safeguard results.
- The application shortens the source's longer camera passages so exploration remains interruptible. This is a deliberate timing difference.

## Camera sequence measured from the source video

The supplied H.264 video is 640 by 512 pixels, 30 frames per second, and 55.167 seconds long. Motion windows below were checked against the original video and the numbered PNGs. Optical flow was sampled every 0.5 seconds at reduced analysis resolution to locate movement peaks. The motion values also include object assembly and UI movement, so they are not pure camera velocity.

| Sequence | Reference time | Observed movement | Implemented interaction |
| --- | --- | --- | --- |
| Wide system overview | 0 to 4 seconds | Slow map drift | Overview control shows graph-derived topology markers and routes. |
| First approach and focus | 4 to 12 seconds | Motion rises around 4 to 6 seconds, then settles on the amber target | Focus moves toward the lattice with decelerating interpolation. |
| Module reveal and operational approach | 12 to 21 seconds | Motion grows around 14 seconds and peaks near 16.5 to 20 seconds | Distinct volumetric housings become legible during the approach. |
| Focused inspection and violation | 21 to 26 seconds | Mostly steady view with local status changes | Simulator outcome changes module and policy-route colors. |
| Return and second selection | 26 to 40 seconds | Strong departure near 26 to 33 seconds, then another target hold | Overview can interrupt any focus move. |
| Re-entry and safeguard comparison | 40 to 54 seconds | Assembly and approach peak near 41.5 to 47.5 seconds, then steady inspection | Focus and Replay select the tested result without a mandatory cinematic wait. |
| Final departure | 54 to 55.167 seconds | Short renewed camera motion | Overview remains available. |

The source moves with a low-high-low motion envelope across each approach. The implementation interpolates toward fixed oblique targets each animation frame with exponential deceleration, so it captures the settling character while remaining interruptible. The focus offset is approximately `(4.35, 6.1, 8.7)` from the selected module and the wide offset approximately `(14, 19, 26)` from the installation center, adjusted for viewport width and user zoom. Reduced-motion mode moves immediately.

## F1 and F2 review checkpoint

The original frame 021 at approximately 21 seconds anchors the detailed installation comparison. Frames 013 to 020 show the assembly rhythm, and frames 045 to 054 show the later operational view. The original assets remain outside the repository.

At 1440 by 900, the four physical modules now span roughly 65% of the usable scene width. At 1827 by 864, they span roughly 55%. These are approximate bounds read from actual browser screenshots. The earlier wide preview occupied roughly 39% of the usable scene width. The wider foundation, recessed service bays, side pathways, and structural ribs provide scale without adding workflow entities.

The test runner has three diagnostic cartridges and a scan bridge. The approval checkpoint has paired locking pylons and a movable barrier that reflects the condition state. The migration check has three storage validation drums. The deployment controller has two dependency rails, an authorization face, and release indicators. All four share physical sockets and use graph-derived execution and policy routes. Their source entities remain the four items in the validated workflow.

The current review screenshots are local browser captures at `C:\Users\user\faultline-visual-evidence`. The `before` directory contains the previously deployed visual preview. The `f1-desktop.png`, `f1-wide.png`, and `f2-*` files contain this F1/F2 revision. The close views crop only the implementation screenshots, never the source frames.

Remaining differences for owner review: the reference has a denser installation and richer distant geography; Faultline keeps four real workflow entities and abstract architectural scenery. The diagnostic rail and trace still use the earlier panel layout. Detailed camera choreography, mobile composition, and full UI integration remain outside this checkpoint. No visual approval is inferred from passing functional checks.
