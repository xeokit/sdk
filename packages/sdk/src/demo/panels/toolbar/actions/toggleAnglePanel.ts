/**
 * Toolbar action — toggle the {@link AngleMeasurementsPanel} on
 * the active View.
 *
 * @module demo/toolbar/actions/toggleAnglePanel
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleAnglePanel: ToolbarActionDescriptor = {
  id: "toggleAnglePanel",
  do(ctx) {
    if (ctx.fireAction("toggleAnglePanel")) return;
    const view = ctx.activeView();
    if (!view || !ctx.demoHelper) {
      console.warn("[Toolbar] toggleAnglePanel — no active View or no DemoHelper.");
      ctx.setPressed("toggleAnglePanel", false);
      return;
    }
    const panel = ctx.demoHelper.toggleAngleMeasurementsPanel(view);
    ctx.setPressed("toggleAnglePanel", panel.visible);
    ctx.bindPanelSync(panel, "toggleAnglePanel");
  }
};
