/**
 * Toolbar action — instantly jump the camera to the scene AABB.
 *
 * @module demo/toolbar/actions/resetView
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const resetView: ToolbarActionDescriptor = {
  id: "resetView",
  do(ctx) {
    if (ctx.fireAction("resetView")) return;
    const aabb = ctx.sceneAabb();
    if (!aabb) {
      console.warn("[Toolbar] resetView — no scene AABB available.");
      return;
    }
    const flight = ctx.cameraFlight();
    if (!flight) {
      console.warn("[Toolbar] resetView — no CameraFlight on the active View.");
      return;
    }
    flight.jumpTo({aabb});
  }
};
