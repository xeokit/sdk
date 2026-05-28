/**
 * Toolbar action — open the demo's {@link CameraTourPanel}.
 *
 * Lives in the same "Present" toolbar group as Drawings and
 * Schema Materials. Camera tours are a presentation/output
 * feature (auto-walkthrough playback), not a diagnostic, so
 * they belong here rather than under Inspect.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openCameraTour: ToolbarActionDescriptor = {
  id: "openCameraTour",
  do(ctx) {
    if (ctx.fireAction("openCameraTour")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openCameraTour — no Studio passed; nothing to drive Camera Tour panel from.");
      return;
    }
    ctx.studio.panels.open("cameraTourPanel");
  },
};
