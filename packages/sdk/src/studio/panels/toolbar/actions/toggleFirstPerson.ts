/**
 * Toolbar action — toggle the active View's
 * {@link ViewController.navMode} between
 * {@link FirstPersonNavigationMode} and
 * {@link OrbitNavigationMode}.
 *
 * The button's pressed state mirrors the live navMode read straight
 * after the flip, so a host that overrides the action via
 * `onAction` (and applies a different navMode itself) still ends
 * up with a correct toggle indicator.
 *
 */

import {FirstPersonNavigationMode, OrbitNavigationMode} from "../../../../base/constants";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleFirstPerson: ToolbarActionDescriptor = {
  id: "toggleFirstPerson",
  do(ctx) {
    if (ctx.fireAction("toggleFirstPerson")) {
      const vcAfter = ctx.viewController();
      if (vcAfter) {
        ctx.setPressed("toggleFirstPerson", vcAfter.navMode === FirstPersonNavigationMode);
      }
      return;
    }
    const vc = ctx.viewController();
    if (!vc) {
      console.warn("[Toolbar] toggleFirstPerson — no ViewController registered for the active View.");
      return;
    }
    const wasFirstPerson = vc.navMode === FirstPersonNavigationMode;
    vc.navMode = wasFirstPerson ? OrbitNavigationMode : FirstPersonNavigationMode;
    ctx.setPressed("toggleFirstPerson", !wasFirstPerson);
  }
};
