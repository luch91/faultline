# Reference design mapping

Source: 55 owner supplied PNG frames in `faultline_exact_video_frames`. The original video was not present in the local workspace during this mapping. The frames are comparison material only and are not bundled in the application.

## Frame breakdown

| Frames | Visible composition and motion | Faultline mapping |
| --- | --- | --- |
| 001-004 | High, oblique map view with dense blue, amber, and violet site markers; narrow navigation and floating data. | Workflow topology overview with actual condition and step markers. |
| 005-007 | Camera descends toward a small, structured installation at the edge of an abstract city. | Camera focuses on the selected workflow's execution group. |
| 008-011 | Selected installation gains an amber locator, curved approach line, and compact contextual reading. | Selected investigation and its evaluated outcome. |
| 012 | Scene dissolves into a dark technical grid. | Transition into the execution group. |
| 013 | Repeated angled supports assemble in regular rows. | Workflow modules enter the lattice at fixed coordinates. |
| 014-016 | Dense three-row panel array appears; thin illuminated blue routes form below it. | Three-row execution lattice with graph-derived dependency paths. |
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
| Blue power cables | Declared dependencies and execution gates |
| Production reading | Evaluated policy and execution outcome |
| Underperforming panel | Violated requirement or unsafe execution path |
| Repair card | Simulator-tested safeguard |
| Trend analysis | Recorded investigation and execution events |
| Site map | Abstract workflow topology with no geographical claim |

## Integration and rights

The scene consumes the existing `Workflow`, `EvaluationResult`, and intervention state. It cannot calculate or override simulator outcomes. The existing intake, extraction, editing, intervention, investigation, safeguard, replay, and export APIs remain in use. A static 2D node list supports small screens and WebGL failure.

The reference contains FuseLab Creative branding and likely proprietary artwork. No frame, watermark, logo, photograph, model, texture, or source asset is redistributed. Geometry, layout, and styling are recreated in code. Three.js and React Three Fiber are MIT licensed dependencies.
