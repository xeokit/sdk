/**
 * Toolbar action — toggle the {@link DistanceMeasurementsPanel}
 * on the active View.
 *
 * @module demo/toolbar/actions/toggleDistancePanel
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleDistancePanel: ToolbarActionDescriptor = {
  id: "toggleDistancePanel",
  do(ctx) {
    if (ctx.fireAction("toggleDistancePanel")) return;
    const view = ctx.activeView();
    if (!view || !ctx.demoHelper) {
      console.warn("[Toolbar] toggleDistancePanel — no active View or no DemoHelper.");
      ctx.setPressed("toggleDistancePanel", false);
      return;
    }
    const panel = ctx.demoHelper.toggleDistanceMeasurementsPanel(view);
    ctx.setPressed("toggleDistancePanel", panel.visible);
    ctx.bindPanelSync(panel, "toggleDistancePanel");
  }
};
