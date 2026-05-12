/**
 * Toolbar action — open the {@link ImportDialog}, a floating
 * dialog that lets the user pick a format and supply each file
 * the format needs from local disk.
 *
 * @module demo/toolbar/actions/importModel
 */

import {ImportDialog} from "../../importDialog";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const importModel: ToolbarActionDescriptor = {
  id: "importModel",
  do(ctx) {
    if (ctx.fireAction("importModel")) return;
    if (!ctx.demoHelper) {
      console.warn("[Toolbar] importModel — no DemoHelper passed; nothing to load into.");
      return;
    }
    ImportDialog.openFor({demoHelper: ctx.demoHelper});
  }
};
