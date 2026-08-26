import type {DistanceMeasurementTool} from "@xeokit/sdk/tools/measurement/distance/DistanceMeasurementTool";

/**
 * Construction parameters for {@link DistanceMeasurementsPanel}.
 */
export interface DistanceMeasurementsPanelParams {

  /**
   * The tool whose measurements the panel lists. The panel is
   * scoped to the tool's {@link DistanceMeasurementTool.view |
   * View} for its per-View singleton registry.
   */
  tool: DistanceMeasurementTool;

  /**
   * DOM container for the panel and its reopen pill. Defaults to
   * `document.body`.
   */
  container?: HTMLElement;

  /**
   * `localStorage` key for the panel's drag-position and
   * closed-state persistence. Defaults to `"xkt-dm-panel"`.
   */
  storageKey?: string;

  /**
   * Show on construction. Defaults to `true`. When `false`, the
   * panel mounts hidden and the floating reopen pill is shown.
   */
  visible?: boolean;
}
