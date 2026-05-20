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
    // Cinematic AABB-fit flight — matches the context-menu Frame …
    // actions: parabolic arc along the camera's look→eye axis, with a
    // slow → fast → slow ("inThenOut") speed profile.
    flight.flyTo({
      aabb,
      fitFOV:   45,
      duration: 0.7,
      arc:      true,
      easing:   "inThenOut",
    });
  }
};
