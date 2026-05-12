/**
 * @module demo/viewObjectContextMenu/ViewObjectContextMenuContext
 */

import type {ViewObject} from "../../viewer";
import type {BaseViewContext} from "./BaseViewContext";


/**
 * Context object consumed by {@link ViewObjectContextMenu}.
 */
export interface ViewObjectContextMenuContext extends BaseViewContext {
  /** View object currently targeted by the menu. */
  viewObject: ViewObject;
}
