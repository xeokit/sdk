/**
 * # Angle Measurements
 *
 * ---
 *
 * **SVG + DOM overlay that paints one or more 3D angle measurements
 * on a {@link viewing!viewer.View | View}'s canvas. Each measurement is a
 * corner vertex and two arms running to an origin and target
 * anchor, labelled with the interior angle in degrees.**
 *
 * ---
 *
 * Mirrors the shape of V2's `AngleMeasurementsPlugin`, but rendered
 * with SVG + DOM (no second renderer or off-screen canvas). One
 * {@link AngleMeasurementsTool} per {@link viewing!viewer.View | View} owns
 * the overlay and a keyed collection of
 * {@link AngleMeasurement | AngleMeasurements}; an optional
 * {@link MouseAngleMeasurementsControl} turns canvas clicks into
 * measurements with three-click creation
 * (origin → corner → target).
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction LR
 *     class AngleMeasurementsTool {
 *       +view                  : View
 *       +picker                : PickStrategy
 *       +defaultColor          : string
 *       +measurements          : Map
 *       +onMeasurementsChanged : EventEmitter
 *       +mouseControl          : MouseAngleMeasurementsControl
 *       +createMeasurement(params) AngleMeasurement
 *       +destroyMeasurement(id)
 *       +clear()
 *       +show() / hide() / toggle()
 *       +destroy()
 *     }
 *     class AngleMeasurement {
 *       +origin / corner / target : Vec3
 *       +angle  : number degrees
 *       +visible / wireVisible / labelsVisible
 *       +color  : string
 *     }
 *     class MouseAngleMeasurementsControl {
 *       +tool   : AngleMeasurementsTool
 *       +active : boolean
 *       +activate()
 *       +deactivate()
 *       +destroy()
 *     }
 *     class AngleMeasurementsToolParams {
 *       +view          : View
 *       +container?    : HTMLElement
 *       +picker?       : PickStrategy
 *       +visible?      : boolean
 *       +defaultColor? : string
 *     }
 *     class AngleMeasurementParams {
 *       +id?            : string
 *       +origin         : Vec3
 *       +corner         : Vec3
 *       +target         : Vec3
 *       +visible?       : boolean
 *       +wireVisible?   : boolean
 *       +labelsVisible? : boolean
 *       +color?         : string
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class PickStrategy {
 *       <<picking>>
 *     }
 *     AngleMeasurementsTool ..> AngleMeasurementsToolParams : openFor
 *     AngleMeasurementsTool "1" *-- "*" AngleMeasurement : measurements
 *     AngleMeasurementsTool ..> AngleMeasurementParams : createMeasurement
 *     AngleMeasurementsTool "1" o-- "0..1" MouseAngleMeasurementsControl : lazy
 *     AngleMeasurementsTool o-- View : paints over
 *     AngleMeasurementsTool o-- PickStrategy : routes clicks
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Per-View singleton** —
 *   {@link AngleMeasurementsTool.openFor | openFor} is idempotent;
 *   re-calling for the same View brings the existing tool back to
 *   the foreground.
 * - **SVG + DOM overlay** — no second renderer or off-screen
 *   canvas; the overlay shares the View canvas's stacking context
 *   so letterboxing and CSS transforms apply uniformly.
 * - **Three-anchor angle** — each measurement renders the two arm
 *   wires (origin → corner, corner → target) plus an angle label
 *   in degrees at the corner. Toggle wires and labels
 *   independently via
 *   {@link AngleMeasurementParams | AngleMeasurementParams}.
 *   Default colour is purple to distinguish from
 *   `DistanceMeasurement`'s orange.
 * - **Snap-aware picking** — the tool routes mouse clicks through
 *   a caller-supplied {@link spatial!picking.PickStrategy | PickStrategy}.
 *   Supply a {@link spatial!picking.RoutingPickStrategy | RoutingPickStrategy}
 *   for snap-to-vertex / snap-to-edge; omit `picker` to get a
 *   default BVH-only picker built from the View's Scene.
 * - **Lazy mouse control** — `tool.mouseControl` lazily constructs
 *   the {@link MouseAngleMeasurementsControl} on first access, so a
 *   tool used purely programmatically never pays its setup cost.
 * - **Coarse change event** —
 *   {@link AngleMeasurementsTool.onMeasurementsChanged | onMeasurementsChanged}
 *   fires after every create / destroy / clear; listeners that
 *   need the current contents re-read the
 *   {@link AngleMeasurementsTool.measurements | measurements} map.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   AngleMeasurementsTool
 * } from "@xeokit/sdk/tools/measurements/angle";
 * ```
 *
 * <br>
 *
 * ### 2) Open the tool on a View
 *
 * `openFor` is the canonical entry — idempotent, View-keyed, and
 * shows the existing tool again if it was hidden.
 *
 * ```javascript
 * const tool = AngleMeasurementsTool.openFor({ view });
 * ```
 *
 * <br>
 *
 * ### 3) Create a measurement programmatically
 *
 * Pass three world-space anchors. The tool computes the angle
 * between the two arms at `corner`; the label updates every frame
 * as the camera moves.
 *
 * ```javascript
 * const m = tool.createMeasurement({
 *   id:     "ridgeAngle",
 *   origin: [10.0,  0.0, 0.0],
 *   corner: [ 0.0,  0.0, 0.0],
 *   target: [ 7.07, 7.07, 0.0]
 * });
 *
 * console.log(m.angle);                   // degrees at corner
 * ```
 *
 * <br>
 *
 * ### 4) Connect mouse-driven creation
 *
 * `tool.mouseControl` is lazy — first access constructs the helper.
 * `activate()` starts listening for clicks on the View canvas;
 * `Esc` cancels an in-progress measurement; `deactivate()` stops
 * listening.
 *
 * ```javascript
 * tool.mouseControl.activate();
 *
 * // ...later, when the user picks a different tool:
 * tool.mouseControl.deactivate();
 * ```
 *
 * <br>
 *
 * ### 5) Snap-aware picking
 *
 * Pass a {@link spatial!picking.RoutingPickStrategy | RoutingPickStrategy}
 * as `picker` to get snap-to-vertex and snap-to-edge in
 * mouse-driven creation. Omit `picker` for a BVH-only fallback.
 *
 * ```javascript
 * import { RoutingPickStrategy } from "@xeokit/sdk/spatial/picking";
 *
 * const picker = new RoutingPickStrategy({ scene: view.scene, renderer });
 *
 * const tool = AngleMeasurementsTool.openFor({
 *   view,
 *   picker
 * });
 * ```
 *
 * <br>
 *
 * ### 6) React to changes
 *
 * `onMeasurementsChanged` is coarse — it fires once per
 * create / destroy / clear without the changed id. Listeners that
 * need the current state re-read
 * {@link AngleMeasurementsTool.measurements | measurements}.
 *
 * ```javascript
 * const unsub = tool.onMeasurementsChanged.subscribe((t) => {
 *   const ids = Object.keys(t.measurements);
 *   console.log(`${ids.length} angle measurements`);
 * });
 * ```
 *
 * <br>
 *
 * ### 7) Show, hide, toggle
 *
 * Visibility on the tool hides the entire overlay; per-measurement
 * visibility flags hide individual measurements while the overlay
 * stays mounted.
 *
 * ```javascript
 * tool.hide();
 * tool.show();
 * const visible = tool.toggle();          // returns the new state
 *
 * m.visible       = false;                // hide one
 * m.wireVisible   = false;                // hide its arm wires only
 * m.labelsVisible = false;                // hide its angle label
 * ```
 *
 * <br>
 *
 * ### 8) Tearing down
 *
 * `destroy` tears down the overlay, every child measurement, and
 * the camera-update subscription. Idempotent.
 *
 * ```javascript
 * tool.destroyMeasurement("ridgeAngle"); // drop one
 * tool.clear();                          // drop all
 * tool.destroy();                        // drop the tool itself
 * ```
 *
 * @module angle
 */

export * from "./AngleMeasurement";
export * from "./AngleMeasurementParams";
export * from "./AngleMeasurementsTool";
export * from "./AngleMeasurementsToolParams";
export * from "./MouseAngleMeasurementsControl";
