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
    if (!ctx.demoHelper) {
      console.warn("[Toolbar] toggleExplorer — no DemoHelper passed; nothing to toggle.");
      ctx.setPressed("toggleExplorer", false);
      return;
    }
    const existing = ExplorerPanel.getFor(ctx.demoHelper.data);
    if (existing && existing.visible) {
      existing.hide();
      ctx.setPressed("toggleExplorer", false);
      ctx.bindPanelSync(existing, "toggleExplorer");
      return;
    }
    const panel = ctx.demoHelper.getExplorer();
    if (!panel) {
      // getExplorer warns and bails when there is no View yet.
      ctx.setPressed("toggleExplorer", false);
      return;
    }
    ctx.setPressed("toggleExplorer", panel.visible);
    ctx.bindPanelSync(panel, "toggleExplorer");
  }
};
