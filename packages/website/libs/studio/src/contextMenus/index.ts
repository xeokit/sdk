/**
 * Public API for the demo's view-object / canvas context menus.
 *
 * Per-submenu builders + helpers live under `./submenus/` and
 * `./helpers/`. Most consumers only need the two menu classes
 * and the matching context types, which are what this barrel
 * exports.
 *
 * @module menus
 */

export {ViewObjectContextMenu} from "./ViewObjectContextMenu";
export {CanvasContextMenu} from "./CanvasContextMenu";
export type {BaseViewContext} from "./BaseViewContext";
export type {ViewObjectContextMenuContext} from "./ViewObjectContextMenuContext";
export type {CanvasContextMenuContext} from "./CanvasContextMenuContext";
