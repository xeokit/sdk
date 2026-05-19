/**
 * # Distance Measurements
 *
 * ---
 *
 * **SVG + DOM overlay that paints one or more 3D distance
 * measurements on a {@link viewing!viewer.View | View}'s canvas. Each
 * measurement shows the diagonal length plus the X/Y/Z axis
 * decomposition between the two anchors.**
 *
 * ---
 *
 * Mirrors the shape of V2's `DistanceMeasurementsPlugin`, but
 * rendered with SVG + DOM (no second renderer or off-screen canvas).
 * One {@link DistanceMeasurementTool} per
 * {@link viewing!viewer.View | View} owns the overlay and a keyed
 * collection of {@link DistanceMeasurement | DistanceMeasurements};
 * an optional {@link MouseDistanceMeasurementsControl} turns canvas
 * clicks into measurements with two-click creation.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class DistanceMeasurementTool {
 *       +view                  : View
 *       +picker                : PickStrategy
 *       +defaultColor          : string
 *       +measurements          : Map
 *       +onMeasurementsChanged : EventEmitter
 *       +mouseControl          : MouseDistanceMeasurementsControl
 *       +createMeasurement(params) DistanceMeasurement
 *       +destroyMeasurement(id)
 *       +clear()
 *       +show() / hide() / toggle()
 *       +destroy()
 *     }
 *     class DistanceMeasurement {
 *       +origin  : Vec3
 *       +target  : Vec3
 *       +visible / wireVisible / axisVisible / labelsVisible
 *       +color   : string
 *     }
 *     class MouseDistanceMeasurementsControl {
 *       +tool    : DistanceMeasurementTool
 *       +active  : boolean
 *       +activate()
 *       +deactivate()
 *       +destroy()
 *     }
 *     class DistanceMeasurementToolParams {
 *       +view          : View
 *       +container?    : HTMLElement
 *       +picker?       : PickStrategy
 *       +visible?      : boolean
 *       +defaultColor? : string
 *     }
 *     class DistanceMeasurementParams {
 *       +id?            : string
 *       +origin         : Vec3
 *       +target         : Vec3
 *       +visible?       : boolean
 *       +wireVisible?   : boolean
 *       +axisVisible?   : boolean
 *       +labelsVisible? : boolean
 *       +color?         : string
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class PickStrategy {
 *       <<picking>>
 *     }
 *     DistanceMeasurementTool ..> DistanceMeasurementToolParams : openFor
 *     DistanceMeasurementTool "1" *-- "*" DistanceMeasurement : measurements
 *     DistanceMeasurementTool ..> DistanceMeasurementParams : createMeasurement
 *     DistanceMeasurementTool "1" o-- "0..1" MouseDistanceMeasurementsControl : lazy
 *     DistanceMeasurementTool o-- View : paints over
 *     DistanceMeasurementTool o-- PickStrategy : routes clicks
 * ```
 *
 * <br>
 *
 * ## Mouse-driven creation
 *
 * ```mermaid
 * flowchart LR
 *     A[activate] --> B[hover dot on pickable geometry]
 *     B --> C[click #1: capture origin]
 *     C --> D[draft measurement follows cursor]
 *     D --> E[click #2: capture target, commit]
 *     E --> F[onMeasurementsChanged]
 *     D -- Esc --> G[discard draft]
 *     F --> B
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Per-View singleton** —
 *   {@link DistanceMeasurementTool.openFor | openFor} is idempotent;
 *   re-calling for the same View brings the existing tool back to the
 *   foreground.
 * - **SVG + DOM overlay** — no second renderer or off-screen canvas;
 *   the overlay shares the View canvas's stacking context so
 *   letterboxing and CSS transforms apply uniformly.
 * - **Diagonal + axis decomposition** — each measurement renders the
 *   diagonal length wire (orange by default) and the red/green/blue
 *   axis wires with per-wire numeric labels. Toggle wires, axes, and
 *   labels independently via
 *   {@link DistanceMeasurementParams | DistanceMeasurementParams}.
 * - **Snap-aware picking** — the tool routes mouse clicks through a
 *   caller-supplied {@link spatial!picking.PickStrategy | PickStrategy}.
 *   Supply a {@link spatial!picking.RoutingPickStrategy | RoutingPickStrategy}
 *   for snap-to-vertex / snap-to-edge; omit `picker` to get a default
 *   BVH-only picker built from the View's Scene.
 * - **Lazy mouse control** — `tool.mouseControl` lazily constructs the
 *   {@link MouseDistanceMeasurementsControl} on first access, so a
 *   tool used purely programmatically never pays its setup cost.
 * - **Coarse change event** —
 *   {@link DistanceMeasurementTool.onMeasurementsChanged | onMeasurementsChanged}
 *   fires after every create / destroy / clear; listeners that need
 *   the current contents re-read the
 *   {@link DistanceMeasurementTool.measurements | measurements} map.
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
 *   DistanceMeasurementTool
 * } from "@xeokit/sdk/studio/systems/measurements/distance";
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
 * const tool = DistanceMeasurementTool.openFor({ view });
 * ```
 *
 * <br>
 *
 * ### 3) Create a measurement programmatically
 *
 * Pass two world-space anchors. The tool computes length and the
 * X/Y/Z decomposition; both update every frame as the camera moves.
 *
 * ```javascript
 * const m = tool.createMeasurement({
 *   id:     "wallToWall",
 *   origin: [12.5, 0.0, 4.2],
 *   target: [18.7, 0.0, 4.2]
 * });
 *
 * console.log(m.length);                  // diagonal world units
 * ```
 *
 * <br>
 *
 * ### 4) Wire up mouse-driven creation
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
 * Pass a {@link spatial!picking.RoutingPickStrategy | RoutingPickStrategy} as
 * `picker` to get snap-to-vertex and snap-to-edge in mouse-driven
 * creation. Omit `picker` for a BVH-only fallback.
 *
 * ```javascript
 * import { RoutingPickStrategy } from "@xeokit/sdk/spatial/picking";
 *
 * const picker = new RoutingPickStrategy({ scene: view.scene, renderer });
 *
 * const tool = DistanceMeasurementTool.openFor({
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
 * {@link DistanceMeasurementTool.measurements | measurements}.
 *
 * ```javascript
 * const unsub = tool.onMeasurementsChanged.subscribe((t) => {
 *   const ids = Object.keys(t.measurements);
 *   console.log(`${ids.length} distance measurements`);
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
 * m.wireVisible   = false;                // hide its diagonal wire only
 * m.axisVisible   = false;                // hide its X/Y/Z wires
 * m.labelsVisible = false;                // hide its labels
 * ```
 *
 * <br>
 *
 * ### 8) Tearing down
 *
 * `destroy` tears down the overlay, every child measurement, and the
 * camera-update subscription. Idempotent.
 *
 * ```javascript
 * tool.destroyMeasurement("wallToWall"); // drop one
 * tool.clear();                          // drop all
 * tool.destroy();                        // drop the tool itself
 * ```
 *
 * @module distance
 */

export * from "./DistanceMeasurement";
export * from "./DistanceMeasurementParams";
export * from "./DistanceMeasurementTool";
export * from "./DistanceMeasurementToolParams";
export * from "./MouseDistanceMeasurementsControl";
