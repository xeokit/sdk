/**
 * @module demo/viewObjectContextMenu/ViewObjectContextMenuContext
 */

import type {ViewObject} from "../../viewing/viewer";
import type {Vec3} from "../../base/math/vector";
import type {BaseViewContext} from "./BaseViewContext";


/**
 * Context object consumed by {@link ViewObjectContextMenu}.
 */
export interface ViewObjectContextMenuContext extends BaseViewContext {
  /** View object currently targeted by the menu. */
  viewObject: ViewObject;
  /**
   * World-space surface point where the right-click landed, when
   * the picker returned one. Submenus that anchor at the clicked
   * point (for example the Transform submenu using the picked
   * point as the gizmo's pivot) read this; `null` falls back to
   * the geometric origin / centroid as appropriate.
   */
  pickedWorldPos?: Vec3 | null;
}
