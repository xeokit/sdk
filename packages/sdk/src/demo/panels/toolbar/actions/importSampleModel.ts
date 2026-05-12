/**
 * Toolbar action — open the demo's {@link SampleModelsPanel},
 * the floating browser for the bundled example models.
 *
 * @module demo/toolbar/actions/importSampleModel
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const importSampleModel: ToolbarActionDescriptor = {
  id: "importSampleModel",
  do(ctx) {
    if (ctx.fireAction("importSampleModel")) return;
    if (!ctx.demoHelper) {
      console.warn("[Toolbar] importSampleModel — no DemoHelper passed; nothing to load into.");
      return;
    }
    ctx.demoHelper.showSampleModels();
  }
};
