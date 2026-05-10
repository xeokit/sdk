import type {Viewer} from "../../viewer";
import type {DemoHelper} from "../DemoHelper";

/**
 * Construction parameters for {@link ViewsPanel}.
 */
export interface ViewsPanelParams {

  /**
   * The Viewer whose Views the panel lists. The panel is keyed
   * off this Viewer for its singleton registry.
   */
  viewer: Viewer;

  /**
   * Optional DemoHelper. Used by the "New View" footer button
   * to spin up a fresh View via {@link DemoHelper.createView}
   * (cloning the active View's camera). Without it, the panel
   * disables the New View button — the panel is then
   * read / destroy only.
   */
  demoHelper?: DemoHelper;

  /**
   * DOM container for the panel and its reopen pill. Defaults
   * to `document.body`.
   */
  container?: HTMLElement;

  /**
   * `localStorage` key for the panel's drag-position and
   * closed-state persistence. Defaults to `"xkt-vw-panel"`.
   */
  storageKey?: string;

  /**
   * Show on construction. Defaults to `true`. When `false`,
   * the panel mounts hidden and the floating reopen pill is
   * shown.
   */
  visible?: boolean;
}
