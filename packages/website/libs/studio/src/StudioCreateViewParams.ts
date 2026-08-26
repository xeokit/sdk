import type {ViewParams} from "@xeokit/sdk/viewing/viewer";
import type {AdaptiveQualityParams} from "@xeokit/sdk/viewing/adaptiveQuality";
import type {ViewPanelParams} from "./panels/viewPanel";


/**
 * Parameters for {@link studio.viewManager.createView}. Extends the SDK's
 * {@link viewing!viewer.ViewParams | ViewParams} with demo-specific options.
 */
export interface StudioCreateViewParams extends ViewParams {

  /**
   * Configure Studio's per-View adaptive quality controller.
   *
   * - `undefined` / `true` — create an AdaptiveQuality adapter for this View
   *   using Studio's `ViewProfiles` defaults.
   * - `false` — do not create an AdaptiveQuality adapter.
   * - {@link viewing!adaptiveQuality.AdaptiveQualityParams} without
   *   `viewProfiles` — create an adapter with the supplied timing / profile
   *   overrides.
   */
  adaptiveQuality?: boolean | Omit<AdaptiveQualityParams, "viewProfiles">;

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
