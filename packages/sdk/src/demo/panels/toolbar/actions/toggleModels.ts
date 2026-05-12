/**
 * Toolbar action — toggle the demo's {@link ModelsPanel}.
 *
 * @module demo/toolbar/actions/toggleModels
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleModels: ToolbarActionDescriptor = {
  id: "toggleModels",
  do(ctx) {
    if (ctx.fireAction("toggleModels")) return;
    if (!ctx.demoHelper) {
      console.warn("[Toolbar] toggleModels — no DemoHelper passed; nothing to toggle.");
      ctx.setPressed("toggleModels", false);
      return;
    }
    const panel = ctx.demoHelper.toggleModelsPanel();
    ctx.setPressed("toggleModels", panel.visible);
    ctx.bindPanelSync(panel, "toggleModels");
  }
};
