/**
 * Toolbar action — toggle 2D ↔ 3D.
 *
 * 2D = top-down ortho on the scene's AABB centre, 3D = perspective
 * at the saved camera pose. Reads worldUp so Z-up scenes (AEC
 * convention) get a top-down look down −Z and Y-up scenes get a
 * top-down look down −Y.
 *
 * @module demo/toolbar/actions/toggle2D3D
 */

import {OrthoProjectionType, PerspectiveProjectionType} from "../../../../constants";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggle2D3D: ToolbarActionDescriptor = {
  id: "toggle2D3D",
  do(ctx) {
    if (ctx.fireAction("toggle2D3D")) return;
    const view = ctx.activeView();
    const camera: any = view && (view as any).camera;
    if (!camera) {
      console.warn("[Toolbar] toggle2D3D — no Camera on the active View.");
      return;
    }
    const wasOrtho = camera.projectionType === OrthoProjectionType;
    camera.projectionType = wasOrtho ? PerspectiveProjectionType : OrthoProjectionType;
    if (!wasOrtho) {
      // Entering 2D → plan view on the scene's AABB centre. Without
      // the worldUp branch the camera ends up inside the model on
      // Z-up scenes.
      const aabb = ctx.sceneAabb();
      if (aabb) {
        const cx = (aabb[0] + aabb[3]) * 0.5;
        const cy = (aabb[1] + aabb[4]) * 0.5;
        const cz = (aabb[2] + aabb[5]) * 0.5;
        const sz = Math.max(aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2]) || 10;
        const worldUp = (ctx.viewer.scene as any)?.coordinateSystem?.worldUp;
        const zUp = !!worldUp && Math.abs(worldUp[2] ?? 0) > Math.abs(worldUp[1] ?? 0);
        try {
          if (zUp) {
            // Camera above the centre on +Z, looking down −Z.
            // "up" on screen is world +Y (typical CAD plan view).
            camera.eye  = [cx, cy, cz + sz];
            camera.look = [cx, cy, cz];
            camera.up   = [0, 1, 0];
          } else {
            // Y-up: above on +Y, looking down −Y; up = world +Z
            // so the view aligns with the AABB's other lateral.
            camera.eye  = [cx, cy + sz, cz];
            camera.look = [cx, cy, cz];
            camera.up   = [0, 0, 1];
          }
        } catch { /* setters might be guarded — best-effort */ }
      }
    }
    ctx.setPressed("toggle2D3D",  !wasOrtho);
    // Keep the perspective/ortho toggle's pressed state in sync —
    // entering 2D also flips projection to ortho.
    ctx.setPressed("toggleProjection", !wasOrtho);
  }
};
