/**
 * Toolbar action — toggle the {@link NavCube} on the active View.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleNavCube: ToolbarActionDescriptor = {
  id: "toggleNavCube",
  do(ctx) {
    if (ctx.fireAction("toggleNavCube")) return;
    const view = ctx.activeView();
    if (!view || !ctx.studio) {
      console.warn("[Toolbar] toggleNavCube — no active View or no Studio.");
      ctx.setPressed("toggleNavCube", false);
      return;
    }
    const cube = ctx.studio.panels.toggle("navCube", {view});
    if (!cube) return;
    ctx.setPressed("toggleNavCube", cube.visible);
    ctx.bindPanelSync(cube, "toggleNavCube");
  }
};
