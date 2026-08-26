/**
 * Context menu for interacting with the canvas or empty view area.
 *
 * Includes only actions that apply to the view, scene, or model as
 * a whole, and excludes actions that require a specific
 * {@link viewing!viewer.ViewObject | ViewObject}.
 *
 * Submenu builders live one-per-file under `./submenus/`; the
 * shape here is a thin composition of those builders, mirrored
 * by {@link ViewObjectContextMenu}.
 *
 * @module studio/viewObjectContextMenu/CanvasContextMenu
 */

import {ContextMenu} from "@xeokit/website-ui/contextmenu";
import type {CanvasContextMenuContext} from "./CanvasContextMenuContext";
import {createCanvasFrameGroup} from "./submenus/createCanvasFrameGroup";
import {createCanvasShowGroup} from "./submenus/createCanvasShowGroup";
import {createCanvasModifyGroup} from "./submenus/createCanvasModifyGroup";
import {createViewProfileGroup} from "./submenus/createViewProfileGroup";
import {createDebugSubmenu} from "./submenus/createDebugSubmenu";


export class CanvasContextMenu extends ContextMenu {

  /**
   * Sets the active context for this menu.
   *
   * @param context Current canvas menu context.
   */
  set context(context: CanvasContextMenuContext) {
    super.context = context;
  }

  /**
   * Creates a canvas context menu with view-level and scene-level
   * actions.
   *
   * @param params Optional params. `debug: true` exposes the
   *   engineer-only Debug submenu. Default `false`.
   */
  constructor(params: { debug?: boolean } = {}) {
    const debug = params.debug === true;
    const debugSub = createDebugSubmenu(debug);
    super({
      // Same verb-led structure as the per-object menu, slimmed
      // down for a click into empty canvas: no per-object actions,
      // and the JSON dumps are dropped (no specific resource to
      // serialize).
      items: [
        createCanvasFrameGroup(),
        [createCanvasShowGroup()],
        [createCanvasModifyGroup()],
        [{
          getTitle: () => "View Profile",
          items: [createViewProfileGroup()],
        }],
        ...(debugSub ? [[debugSub]] : []),
      ]
    });
  }
}
