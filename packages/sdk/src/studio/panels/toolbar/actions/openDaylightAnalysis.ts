/**
 * Toolbar action — toggle the {@link DaylightAnalysisPanel}.
 *
 * Lives in the "Present" toolbar group alongside Sun Study,
 * Drawings, Camera Tours, and Schema Materials. The panel is
 * per-(SunStudy, Scene) pair and the Toolbar has no direct
 * reference to either, so the action toggles whichever panel
 * the application has already set up via
 * `studio.panels.open("daylightAnalysisPanel", {sunStudy, scene})`.
 * If no panel has been opened yet, the click is a no-op + warn.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openDaylightAnalysis: ToolbarActionDescriptor = {
  id: "openDaylightAnalysis",
  do(ctx) {
    if (ctx.fireAction("openDaylightAnalysis")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openDaylightAnalysis — no Studio passed; nothing to drive Daylight Analysis panel from.");
      return;
    }
    // The registry's `create` provider auto-constructs a default
    // SunStudy on the first available View when none exists, and
    // pulls the Scene off Studio — so the toolbar always works
    // without app-side setup. A null here means no View yet,
    // which the registry has already warned about.
    const panel = ctx.studio.panels.toggle("daylightAnalysisPanel");
    if (panel) ctx.bindPanelSync(panel, "openDaylightAnalysis");
  },
};
