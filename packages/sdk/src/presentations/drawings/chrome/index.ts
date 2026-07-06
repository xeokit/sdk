/**
 * # Drawing Chrome
 *
 * Backing panel and title-block specs for drawing output.
 *
 * Both specs are optional inputs to {@link buildDrawing}. They sit on
 * top of the projection plane
 * and are never clipped, hidden, or pickable — chrome is not part of
 * the source model.
 *
 * - {@link PanelSpec} — backing quad behind the line work, optionally
 *   textured via a `procgen.paintMaterials` painter.
 * - {@link TitleBlockSpec} — heading row plus labelled `LABEL | value`
 *   rows, sized to a fraction of the frame width and pinned to its
 *   bottom-right corner.
 *
 * <br>
 *
 * ## Usage
 *
 * Chrome is passed inline to {@link buildDrawing}:
 *
 * ```javascript
 * import { buildDrawing } from "@xeokit/sdk/presentations/drawings";
 *
 * await buildDrawing({
 *   scene,
 *   sourceModel:   scene.models["myModel"],
 *   targetModelId: "myModel__sheet",
 *   direction:     "front",
 *
 *   frame:      1.5,
 *   frameColor: [0.05, 0.25, 0.85],
 *
 *   panel: {
 *     color:        [1, 1, 1],
 *     opacity:      0.55,
 *     textureScale: 1.0
 *   },
 *
 *   titleBlock: {
 *     title: "BUILDING A — FRONT ELEVATION",
 *     rows: [
 *       { label: "PROJECT", value: "TOWER 42"   },
 *       { label: "SCALE",   value: "1 : 100"    },
 *       { label: "DATE",    value: "2026-05-14" }
 *     ],
 *     widthFraction: 0.42
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### Textured panels
 *
 * The `panel.paint` painter is a zero-arg callback that returns a
 * `MaterialMaps` triple from `procgen.paintMaterials`
 * (colour, normal, and metallic-roughness). The projector creates the
 * three textures and a {@link model!scene.SceneMaterial | SceneMaterial}
 * inside the target SceneModel and binds the panel quad to it via
 * triplanar mapping (the quad carries no UVs).
 *
 * ```javascript
 * import { paintBlueprint } from "@xeokit/sdk/model/procgen/paintMaterials";
 *
 * await buildDrawing({
 *   // ...
 *   panel: {
 *     color:        [1, 1, 1],
 *     opacity:      0.9,
 *     textureScale: 2.0,
 *     paint:        () => paintBlueprint()
 *   }
 * });
 * ```
 *
 * The painter is invoked once per `buildDrawing` call. Cache the returned
 * maps if multiple projections should share one texture set.
 *
 * @module chrome
 */
export * from "./PanelSpec";
export * from "./TitleBlockSpec";
