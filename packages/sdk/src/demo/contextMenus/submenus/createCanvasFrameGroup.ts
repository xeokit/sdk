/**
 * Frame group on the canvas menu — Scene only, since there's no
 * specific {@link ViewObject} or focused SceneModel without an
 * object pick.
 *
 * @module demo/viewObjectContextMenu/submenus/createCanvasFrameGroup
 */

import type {CanvasContextMenuContext} from "../CanvasContextMenuContext";


export function createCanvasFrameGroup() {
  return [
    {
      getTitle: () => "Frame Scene",
      doAction: (context: CanvasContextMenuContext) => {
        context.cameraFlight.jumpTo({
          aabb: context.collisionIndex.getSceneAABB(),
          duration: 0.5,
          fitFOV: 40
        });
      }
    },
  ];
}
