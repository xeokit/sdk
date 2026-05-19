/**
 * AngleMeasurementsPanel — floating, draggable panel that lists
 * every {@link AngleMeasurement | AngleMeasurement}
 * currently mounted on a per-View
 * {@link AngleMeasurementsTool | AngleMeasurementsTool},
 * with per-row destroy buttons and a "Clear all" footer button.
 *
 * Sister widget to
 * {@link demo!distanceMeasurementsPanel | DistanceMeasurementsPanel}
 * — same floating chrome and drag / persistence mechanics, with a
 * purple accent matching the angle tool's default colour and a
 * degree-formatted value column instead of a length column.
 *
 * @module demo/angleMeasurementsPanel
 */

export {AngleMeasurementsPanel} from "./AngleMeasurementsPanel";
export type {AngleMeasurementsPanelParams} from "./AngleMeasurementsPanelParams";
