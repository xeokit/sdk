/**
 * Toolbar action — open the {@link AdaptiveQualityPanel}.
 *
 * Lives in the "Performance" toolbar group next to Culling. Adaptive
 * quality is a runtime performance control (it flips the View into
 * `fast` profile while the camera moves so expensive effects skip),
 * so it sits alongside Culling rather than under Inspect.
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openAdaptiveQuality: ToolbarActionDescriptor = {
  id: "openAdaptiveQuality",
  do(ctx) {
    if (ctx.fireAction("openAdaptiveQuality")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openAdaptiveQuality — no Studio passed; nothing to drive the Adaptive Quality panel from.");
      return;
    }
    ctx.studio.panels.open("adaptiveQualityPanel");
  },
};
