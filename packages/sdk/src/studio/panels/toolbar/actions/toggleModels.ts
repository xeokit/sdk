/**
 * Toolbar action — toggle the demo's {@link ModelsPanel}.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleModels: ToolbarActionDescriptor = {
  id: "toggleModels",
  do(ctx) {
    if (ctx.fireAction("toggleModels")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] toggleModels — no Studio passed; nothing to toggle.");
      ctx.setPressed("toggleModels", false);
      return;
    }
    const panel = ctx.studio.panels.toggle("modelsPanel");
    if (!panel) return;
    ctx.setPressed("toggleModels", panel.visible);
    ctx.bindPanelSync(panel, "toggleModels");
  }
};
