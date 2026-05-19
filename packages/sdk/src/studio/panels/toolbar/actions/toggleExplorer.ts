/**
 * Toolbar action — toggle the demo's {@link ExplorerPanel}.
 *
 * @module demo/toolbar/actions/toggleExplorer
 */

import {ExplorerPanel} from "../../explorerPanel/ExplorerPanel";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleExplorer: ToolbarActionDescriptor = {
  id: "toggleExplorer",
  do(ctx) {
    if (ctx.fireAction("toggleExplorer")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] toggleExplorer — no Studio passed; nothing to toggle.");
      ctx.setPressed("toggleExplorer", false);
      return;
    }
    const existing = ExplorerPanel.getFor(ctx.studio.data);
    if (existing && existing.visible) {
      existing.hide();
      ctx.setPressed("toggleExplorer", false);
      ctx.bindPanelSync(existing, "toggleExplorer");
      return;
    }
    const panel = ctx.studio.panels.open("explorerPanel");
    if (!panel) {
      // explorerPanel provider warns and bails when there is no View yet.
      ctx.setPressed("toggleExplorer", false);
      return;
    }
    ctx.setPressed("toggleExplorer", panel.visible);
    ctx.bindPanelSync(panel, "toggleExplorer");
  }
};
