/**
 * Toolbar action — open the demo's {@link SampleModelsPanel},
 * the floating browser for the bundled example models.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const importSampleModel: ToolbarActionDescriptor = {
  id: "importSampleModel",
  do(ctx) {
    if (ctx.fireAction("importSampleModel")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] importSampleModel — no Studio passed; nothing to load into.");
      return;
    }
    ctx.studio.panels.open("sampleModels");
  }
};
