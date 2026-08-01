/**
 * Toolbar action — toggle walk navigation on the active View.
 *
 * The action id is kept as `toggleFirstPerson` for compatibility with
 * existing host overrides, but the built-in implementation now uses
 * {@link WalkNavigationController} instead of the older
 * {@link ViewController.navMode} first-person mode.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleFirstPerson: ToolbarActionDescriptor = {
  id: "toggleFirstPerson",
  do(ctx) {
    if (ctx.fireAction("toggleFirstPerson")) {
      const walkAfter = ctx.walkNavigationController();
      if (walkAfter) {
        ctx.setPressed("toggleFirstPerson", walkAfter.active);
      }
      return;
    }
    const walk = ctx.walkNavigationController();
    if (!walk) {
      console.warn("[Toolbar] toggleFirstPerson — no walk navigation controller registered for the active View.");
      return;
    }
    walk.active = !walk.active;
    ctx.setPressed("toggleFirstPerson", walk.active);
  }
};
