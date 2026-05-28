/**
 * Toolbar action — open the demo's {@link ExportDialog}.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openExport: ToolbarActionDescriptor = {
  id: "openExport",
  do(ctx) {
    if (ctx.fireAction("openExport")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openExport — no Studio passed; nothing to export.");
      return;
    }
    ctx.studio.panels.open("exportDialog");
  }
};
