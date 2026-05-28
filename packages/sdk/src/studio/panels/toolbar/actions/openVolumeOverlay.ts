/**
 * Toolbar action — toggle the {@link VolumeOverlayPanel}.
 *
 * Lives in the "Present" toolbar group alongside Sun Study and
 * Daylight Analysis. Unlike those two, there's no sensible auto-
 * construct path for the cold-start case — a volume overlay is
 * meaningful only against an application-supplied
 * {@link VoxelGrid}, so the toolbar can only *toggle* an already-
 * mounted panel. If none has been opened the click is a no-op
 * with a brief warning.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openVolumeOverlay: ToolbarActionDescriptor = {
  id: "openVolumeOverlay",
  do(ctx) {
    if (ctx.fireAction("openVolumeOverlay")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openVolumeOverlay — no Studio passed; nothing to drive Volume Overlay panel from.");
      return;
    }
    // Registry's `create` provider auto-constructs a demo field
    // (+ companion vector field) covering the scene's AABB when
    // the application hasn't supplied one — so a click here
    // always produces something visible. A null return means no
    // Scene was reachable, which the registry has already warned
    // about.
    const panel = ctx.studio.panels.toggle("volumeOverlayPanel");
    if (panel) ctx.bindPanelSync(panel, "openVolumeOverlay");
  },
};
