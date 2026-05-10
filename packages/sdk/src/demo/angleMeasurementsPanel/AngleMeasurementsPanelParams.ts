import type {AngleMeasurementsTool} from "../measurements/angle/AngleMeasurementsTool";

/**
 * Construction parameters for {@link AngleMeasurementsPanel}.
 */
export interface AngleMeasurementsPanelParams {

  /**
   * The tool whose measurements the panel lists. The panel is
   * scoped to the tool's {@link AngleMeasurementsTool.view | View}
   * for its per-View singleton registry.
   */
  tool: AngleMeasurementsTool;

  /**
   * DOM container for the panel and its reopen pill. Defaults to
   * `document.body`.
   */
  container?: HTMLElement;

  /**
   * `localStorage` key for the panel's drag-position and
   * closed-state persistence. Defaults to `"xkt-am-panel"`.
   */
  storageKey?: string;

  /**
   * Show on construction. Defaults to `true`. When `false`, the
   * panel mounts hidden and the floating reopen pill is shown.
   */
  visible?: boolean;
}
