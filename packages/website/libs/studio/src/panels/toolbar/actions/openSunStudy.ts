/**
 * Toolbar action — toggle the {@link SunStudyPanel}.
 *
 * Lives in the "Present" toolbar group alongside Drawings,
 * Camera Tours, Schema Materials, and Daylight Analysis. The
 * panel is per-SunStudy and the Toolbar has no direct
 * {@link SunStudy} reference, so the action toggles whichever
 * panel the application has already set up via
 * `studio.panels.open("sunStudyPanel", {sunStudy, player})`.
 * If no panel has been opened yet, the click is a no-op + warn.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openSunStudy: ToolbarActionDescriptor = {
  id: "openSunStudy",
  do(ctx) {
    if (ctx.fireAction("openSunStudy")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openSunStudy — no Studio passed; nothing to drive Sun Study panel from.");
      return;
    }
    // The registry's `create` provider auto-constructs a default
    // SunStudy on the first available View when none exists, so
    // the toolbar always works — no app-side setup required.
    // A null return here means there's no View to attach to,
    // which the registry has already warned about.
    const panel = ctx.studio.panels.toggle("sunStudyPanel");
    if (panel) ctx.bindPanelSync(panel, "openSunStudy");
  },
};
