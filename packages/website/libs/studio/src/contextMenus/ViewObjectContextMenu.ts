/**
 * Context menu for interacting with a {@link viewing!viewer.ViewObject | ViewObject}.
 *
 * The menu is organized around the most common user goals:
 *
 *   1. Navigating and framing
 *   2. Changing object visibility, x-ray, and selection state
 *   3. Inspecting object data and opening diagnostic panels
 *   4. Modifying the object (materials, IFC, demolish)
 *   5. View-level settings (visual style, projection)
 *   6. Importing / exporting
 *   7. Deleting
 *
 * Submenu builders live one-per-file under `./submenus/`; the
 * shape here is a thin composition of those builders, mirrored
 * by {@link CanvasContextMenu}.
 *
 * @module studio/viewObjectContextMenu/ViewObjectContextMenu
 */

import {ContextMenu} from "@xeokit/website-ui/contextmenu";
import type {ViewObjectContextMenuContext} from "./ViewObjectContextMenuContext";
import {createViewObjectFrameGroup} from "./submenus/createViewObjectFrameGroup";
import {createViewObjectShowGroup} from "./submenus/createViewObjectShowGroup";
import {createViewObjectModifyGroup} from "./submenus/createViewObjectModifyGroup";
import {createViewObjectTransformGroup} from "./submenus/createViewObjectTransformGroup";
import {createViewObjectDeleteGroup} from "./submenus/createViewObjectDeleteGroup";
import {createViewProfileGroup} from "./submenus/createViewProfileGroup";
import {createDebugSubmenu} from "./submenus/createDebugSubmenu";


export class ViewObjectContextMenu extends ContextMenu {

  /**
   * Sets the active context for this menu.
   *
   * @param context Current view-object menu context.
   */
  set context(context: ViewObjectContextMenuContext) {
    super.context = context;
  }

  /**
   * Creates a view-object context menu with predefined grouped
   * actions.
   *
   * @param params Optional params. `debug: true` exposes the
   *   engineer-only Debug submenu (currently the WebGL
   *   context-loss simulator). Default `false`.
   */
  constructor(params: { debug?: boolean } = {}) {
    const debug = params.debug === true;
    const debugSub = createDebugSubmenu(debug);
    super({
      // Verb-led structure, contextual actions only — viewer-wide
      // diagnostic panels (Health, Statistics, GPU Memory, Events,
      // …) and settings now live on the toolbar's Inspect dropdown,
      // not here:
      //   Frame ▶ — three flat actions, the most-used at the top.
      //   Show  ▶ — visibility, x-ray, selection (was a 3-deep Display
      //             tree, flattened to one submenu with separators).
      //   Modify ▶ — non-destructive mutations (Change Material,
      //              IFC Materials, Demolish — was the old Effects
      //              + standalone Change Material).
      //   Delete — last group, with the natural separator above acting
      //            as a visual moat against the destructive actions.
      items: [
        createViewObjectFrameGroup(),
        [createViewObjectShowGroup()],
        [createViewObjectModifyGroup()],
        [createViewObjectTransformGroup()],
        [{
          getTitle: () => "View Profile",
          items: [createViewProfileGroup()],
        }],
        createViewObjectDeleteGroup(),
        ...(debugSub ? [[debugSub]] : []),
      ]
    });
  }
}
