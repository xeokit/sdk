/**
 * Toolbar action — toggle the {@link NavCube} on the active View.
 *
 * @module demo/toolbar/actions/toggleNavCube
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleNavCube: ToolbarActionDescriptor = {
  id: "toggleNavCube",
  do(ctx) {
    if (ctx.fireAction("toggleNavCube")) return;
    const view = ctx.activeView();
    if (!view || !ctx.demoHelper) {
      console.warn("[Toolbar] toggleNavCube — no active View or no DemoHelper.");
      ctx.setPressed("toggleNavCube", false);
      return;
    }
    const cube = ctx.demoHelper.toggleNavCube(view);
    ctx.setPressed("toggleNavCube", cube.visible);
    ctx.bindPanelSync(cube, "toggleNavCube");
  }
};
