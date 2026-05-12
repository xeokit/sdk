/**
 * Toolbar action — animated camera flight to the scene AABB.
 *
 * @module demo/toolbar/actions/fitAll
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const fitAll: ToolbarActionDescriptor = {
  id: "fitAll",
  do(ctx) {
    if (ctx.fireAction("fitAll")) return;
    const aabb = ctx.sceneAabb();
    if (!aabb) {
      console.warn("[Toolbar] fitAll — no scene AABB available.");
      return;
    }
    const flight = ctx.cameraFlight();
    if (!flight) {
      console.warn("[Toolbar] fitAll — no CameraFlight on the active View.");
      return;
    }
    flight.flyTo({aabb});
  }
};
