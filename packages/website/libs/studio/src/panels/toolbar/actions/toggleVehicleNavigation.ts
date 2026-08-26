/**
 * Toolbar action — toggle vehicle navigation on the active View.
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleVehicleNavigation: ToolbarActionDescriptor = {
  id: "toggleVehicleNavigation",
  do(ctx) {
    if (ctx.fireAction("toggleVehicleNavigation")) {
      const vehicleAfter = ctx.vehicleNavigationController();
      if (vehicleAfter) {
        ctx.setPressed("toggleVehicleNavigation", vehicleAfter.active);
      }
      return;
    }
    const vehicle = ctx.vehicleNavigationController();
    if (!vehicle) {
      console.warn("[Toolbar] toggleVehicleNavigation — no vehicle navigation controller registered for the active View.");
      return;
    }
    const nextActive = !vehicle.active;
    if (nextActive) {
      const walk = ctx.walkNavigationController();
      if (walk) {
        walk.active = false;
        ctx.setPressed("toggleFirstPerson", false);
      }
    }
    vehicle.active = nextActive;
    ctx.setPressed("toggleVehicleNavigation", vehicle.active);
  }
};
