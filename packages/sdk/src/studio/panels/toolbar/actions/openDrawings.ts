/**
 * Toolbar action — open the demo's {@link DrawingsPanel}.
 *
 * Surfaces the panel from a dedicated top-level "Present" group
 * on the toolbar rather than burying it in the Inspect dropdown —
 * Drawings is a presentation/output feature, not a diagnostic.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openDrawings: ToolbarActionDescriptor = {
  id: "openDrawings",
  do(ctx) {
    if (ctx.fireAction("openDrawings")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openDrawings — no Studio passed; nothing to drive Drawings panel from.");
      return;
    }
    ctx.studio.panels.open("drawingsPanel");
  }
};
