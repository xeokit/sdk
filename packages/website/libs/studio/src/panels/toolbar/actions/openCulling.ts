/**
 * Toolbar action — open the {@link CullingPanel}.
 *
 * Lives in the "Performance" toolbar group next to Camera. Culling
 * is a runtime performance control (it trims the per-View draw load),
 * so it sits with the other frame-rate-facing tooling rather than
 * under the Inspect diagnostics menu.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openCulling: ToolbarActionDescriptor = {
  id: "openCulling",
  do(ctx) {
    if (ctx.fireAction("openCulling")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openCulling — no Studio passed; nothing to drive the Culling panel from.");
      return;
    }
    ctx.studio.panels.open("cullingPanel");
  },
};
