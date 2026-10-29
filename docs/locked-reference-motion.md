# Locked video implementation map

Design authority: the supplied `fl new(1).mp4`, duration 18.566667 seconds, 750 x 512 pixels, 557 video frames at 30 fps. The source remains unaltered. SHA-256: dd2d8f608249600334fe6427a6143932f44605c3a8364d59b77206cc79042b6e.

All 557 frames were extracted for internal inspection, reviewed in chronological 30-frame sheets, and analyzed for frame difference. Measured hard cuts occur at frames 47, 210, 314, 388, and 530. The camera code uses these boundaries rather than an unrelated animation preset.

| Frames | Time | Reference behavior | Implementation |
| --- | --- | --- | --- |
| 0 to 46 | 0 to 1.533 | Flat multi-cluster network, colored nodes, thin relationships, ranking directory, selected cyan node and connection list | Live SVG from workflow entities, source spans, source tokens, conditions, policy rules, execution gates, and actual evaluator results. Search, filters, heatmap, hover, selection, zoom, pan, ranking selection work. |
| 47 to 63 | 1.567 to 2.100 | Hard camera cut, perspective plane, fade and collapse toward blue focus | Measured screen-corner homography on live DOM, overview opacity falls and focus appears. |
| 64 to 80 | 2.133 to 2.667 | Blue central node appears with compact local connections | Central entity appears before peripheral labels. |
| 81 to 140 | 2.700 to 4.667 | Curved spokes expand outward progressively, staggered endpoint and text reveals | Deterministic path progress, per-spoke delay, radial endpoint movement, line dash offset, and delayed label opacity. No React Flow animation. |
| 141 to 209 | 4.700 to 6.967 | Completed radial view, analytics overview, continuing camera drift | Two labeled fans around the selected entity, real context paths and directional policy/gate semantics, compact chart and tables. |
| 210 to 313 | 7.000 to 10.433 | Hard camera cut to opposite perspective; analytics widens; radial graph compresses left | Second screen-corner projection, panel width expands from 245 to 350 design pixels, graph reflows with it; chart, metrics, policies, gates, and ranking retain source styling. |
| 314 to 387 | 10.467 to 12.900 | Hard cut to distant overview on black presentation platform; network reorganizes around highlighted cyan condition cluster | Overview returns with condition cluster translation, light cyan selection emphasis, reduced live screen bounds, and code-rendered background. |
| 388 to 529 | 12.933 to 17.633 | Closer overview; network clusters migrate back; camera approaches flat screen, selected blue relationship returns | Interpolated screen bounds, deterministic cluster return movement, retained investigation selection. |
| 530 to 556 | 17.667 to 18.533 | Final camera cut back to perspective; overview collapses toward blue node again | Repeated measured perspective and final focus collapse, ending at the source duration. |

## Layout and visual measurements

The app plane is 750 x 490 design pixels inside a 750 x 512 stage. The header is 39 pixels high and the filter/context row is 38 pixels. The overview ranking directory is 180 pixels wide. Source-inspired text uses Arial/Helvetica at 5 to 11 design pixels and scales with the live plane. The network background ranges from #171822 to #222534; panels use #232738; edges use muted gray-blue. Node groups use teal, purple, cyan, muted rose, and ochre.

The focused graph uses a cyan central node, two curved relationship fans, surrounding small labels, and an adjacent analytics panel. Context spokes label their actual path. A policy connection through a rule is not represented as an execution gate. Verified safeguards introduce only the tested gate.

## Data and fidelity boundaries

The available deployment sample is smaller than the source application's dataset. Source-linked text tokens and field observations are real provenance records, not fictional workflows or incidents. Ranking and chart values are computed from actual declared link degrees. The chart retains the reference's teal line/area, axes, grid, placement, and density; its shape follows Faultline data, not invented market values.

The video supplies compressed 750-pixel raster imagery, not font files, the source application's vector assets, or the presentation scene's original geometry, lighting, and materials. The monitor and black platform surround are reconstructed in code from measured corners and silhouettes. They are not video frames or embedded source imagery. Residual scene-shading differences and unreadable source microcopy must be reported accurately during visual QA.

Reduced-motion preferences snap interactive focus and return to their completed states. Explicitly playing the presentation remains an intentional motion action. The native workflow tools dialog preserves readable functional controls at mobile sizes without changing the desktop composition.
