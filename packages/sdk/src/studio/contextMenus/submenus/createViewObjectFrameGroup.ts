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


export function createViewObjectFrameGroup() {
  return [
    {
      getTitle: () => "Frame Object",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.jumpTo({
          aabb: context.collisionIndex.getObjectAABB(context.viewObject.id),
          duration: 0.5,
          fitFOV: 40
        });
      }
    },
    {
      getTitle: () => "Frame Model",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.jumpTo({
          aabb: getSceneModelAABB(context),
          duration: 0.5,
          fitFOV: 40
        });
      }
    },
    {
      getTitle: () => "Frame Scene",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.cameraFlight.jumpTo({
          aabb: context.collisionIndex.getSceneAABB(),
          duration: 0.5,
          fitFOV: 40
        });
      }
    }
  ];
}
