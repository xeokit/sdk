/**
 * Toolbar action — toggle the {@link DistanceMeasurementsPanel}
 * on the active View.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleDistancePanel: ToolbarActionDescriptor = {
  id: "toggleDistancePanel",
  do(ctx) {
    if (ctx.fireAction("toggleDistancePanel")) return;
    const view = ctx.activeView();
    if (!view || !ctx.studio) {
      console.warn("[Toolbar] toggleDistancePanel — no active View or no Studio.");
      ctx.setPressed("toggleDistancePanel", false);
      return;
    }
    const panel = ctx.studio.panels.toggle("distanceMeasurementsPanel", {view});
    if (!panel) return;
    ctx.setPressed("toggleDistancePanel", panel.visible);
    ctx.bindPanelSync(panel, "toggleDistancePanel");
  }
};
