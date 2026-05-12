/**
 * Toolbar action — open the demo's {@link ExportDialog}.
 *
 * @module demo/toolbar/actions/openExport
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openExport: ToolbarActionDescriptor = {
  id: "openExport",
  do(ctx) {
    if (ctx.fireAction("openExport")) return;
    if (!ctx.demoHelper) {
      console.warn("[Toolbar] openExport — no DemoHelper passed; nothing to export.");
      return;
    }
    ctx.demoHelper.openExportDialog();
  }
};
