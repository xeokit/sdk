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
    if (!view || !ctx.studio) {
      console.warn("[Toolbar] toggleAnglePanel — no active View or no Studio.");
      ctx.setPressed("toggleAnglePanel", false);
      return;
    }
    const panel = ctx.studio.panels.toggle("angleMeasurementsPanel", {view});
    if (!panel) return;
    ctx.setPressed("toggleAnglePanel", panel.visible);
    ctx.bindPanelSync(panel, "toggleAnglePanel");
  }
};
