/**
 * Toolbar action — toggle the demo's "Views" panel
 * ({@link ViewerConfigPanel}, which exposes the live
 * `ViewerParams` for editing, plus per-View destroy buttons and
 * a "New View" footer button).
 *
 * @module demo/toolbar/actions/toggleViews
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleViews: ToolbarActionDescriptor = {
  id: "toggleViews",
  do(ctx) {
    if (ctx.fireAction("toggleViews")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] toggleViews — no Studio passed; nothing to toggle.");
      ctx.setPressed("toggleViews", false);
      return;
    }
    const panel = ctx.studio.panels.toggle("viewerConfig");
    if (!panel) return;
    ctx.setPressed("toggleViews", panel.visible);
    ctx.bindPanelSync(panel, "toggleViews");
  }
};
