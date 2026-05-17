/**
 * # xeokit Measurements
 *
 * ---
 *
 * **SVG + DOM overlay widgets that paint world-space measurements
 * on a {@link viewing!viewer.View | View}'s canvas — diagonal distance with
 * X/Y/Z decomposition, and three-anchor angle in degrees.**
 *
 * ---
 *
 * The `measurements` module ships one tool per measurement type. Each
 * tool is a long-lived overlay attached to a single
 * {@link viewing!viewer.View | View}, owning a keyed collection of measurement
 * instances. Optional mouse-control helpers turn canvas clicks into
 * measurements without the caller having to wire up pickers.
 *
 * <br>
 *
 * ## Sub-modules
 *
 * - {@link distance | distance} — point-to-point 3D distance with
 *   X/Y/Z axis decomposition. Two-click creation via
 *   {@link distance.MouseDistanceMeasurementsControl | MouseDistanceMeasurementsControl}.
 * - {@link angle | angle} — three-anchor (origin, corner, target)
 *   angle at the corner, in degrees. Three-click creation via
 *   {@link angle.MouseAngleMeasurementsControl | MouseAngleMeasurementsControl}.
 *
 * <br>
 *
 * ## Shape
 *
 * Both sub-modules share the same tool / measurement / mouse-control
 * shape:
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class Tool {
 *       <<distance or angle>>
 *       +view              : View
 *       +measurements      : Map
 *       +createMeasurement(params)
 *       +destroyMeasurement(id)
 *       +clear()
 *       +show() / hide() / toggle()
 *       +destroy()
 *     }
 *     class Measurement {
 *       <<one per anchor set>>
 *     }
 *     class MouseControl {
 *       +activate()
 *       +deactivate()
 *       +destroy()
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class PickStrategy {
 *       <<picking>>
 *     }
 *     Tool "1" *-- "*" Measurement : owns
 *     Tool "1" o-- "0..1" MouseControl : lazy
 *     Tool o-- View : paints over
 *     Tool o-- PickStrategy : routes clicks
 * ```
 *
 * Each tool is a per-View singleton — `openFor(params)` returns the
 * existing instance for `params.view` (showing it again if hidden) or
 * constructs a fresh one. See the sub-module docs for end-to-end
 * snippets.
 *
 * @module measurements
 */

export * as distance from "./distance";
export * as angle from "./angle";
