/**
 * Frame group on the view-object menu — three flat actions, most
 * specific to least: object, model, scene. Top-level (not nested
 * under a "Frame" submenu) because framing is the most common
 * right-click reason and an extra hover delays it.
 *
 * @module demo/viewObjectContextMenu/submenus/createViewObjectFrameGroup
 */

import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";
import {getSceneModelAABB} from "../helpers/sceneRefs";


// Shared flight params for the three Frame actions. `arc` + `inThenOut`
// produce a parabolic lift along the look→eye axis with a slow → fast
// → slow speed profile, so the camera reads as travelling across the
// scene rather than teleporting.
const FRAME_FLIGHT = {
  fitFOV:   45,
  duration: 0.7,
  arc:      true,
  easing:   "inThenOut" as const,
};

export function createViewObjectFrameGroup() {
  return [
    {
      getTitle: () => "Frame Object",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.flyTo({
          ...FRAME_FLIGHT,
          aabb: context.collisionIndex.getObjectAABB(context.viewObject.id),
        });
      }
    },
    {
      getTitle: () => "Frame Model",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.flyTo({
          ...FRAME_FLIGHT,
          aabb: getSceneModelAABB(context),
        });
      }
    },
    {
      getTitle: () => "Frame Scene",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.flyTo({
          ...FRAME_FLIGHT,
          aabb: context.collisionIndex.getSceneAABB(),
        });
      }
    }
  ];
}
