import type {ViewParams} from "../viewing/viewer";
import type {ViewPanelParams} from "./panels/viewPanel";


/**
 * Parameters for {@link studio.viewManager.createView}. Extends the SDK's
 * {@link viewing!viewer.ViewParams | ViewParams} with demo-specific options.
 */
export interface StudioCreateViewParams extends ViewParams {

  /**
   * Open the new View inside a {@link ViewPanel} — a floating,
   * draggable panel with the same chrome (header, close button,
   * reopen pill, layout persistence) as the other demo panels.
   *
   * - `false` / omitted — append the View's canvas to the shared
   *   layout container, tiled alongside any other auto-laid-out
   *   Views.
   * - `true` — wrap the canvas in a `ViewPanel` using default panel
   *   parameters (title `"View — {id}"`, 480 × 360 initial size).
   * - {@link ViewPanelParams} — wrap and forward the supplied panel
   *   parameters (title, initial size, container).
   *
   * Ignored when {@link viewing!viewer.ViewParams.elementId | elementId} or
   * {@link viewing!viewer.ViewParams.htmlElement | htmlElement} is set, since
   * the caller is supplying their own DOM target.
   */
  floating?: boolean | Omit<ViewPanelParams, "onClose">;
}
