/**
 * Frame group on the canvas menu — Scene only, since there's no
 * specific {@link viewing!viewer.ViewObject | ViewObject} or focused SceneModel without an
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
        // Cinematic AABB-fit flight — `arc + inThenOut` lifts the
        // camera along its look→eye axis into a parabolic apex at
        // t = 0.5, with a slow → fast → slow speed profile.
        context.cameraFlight.flyTo({
          aabb:     context.collisionIndex.getSceneAABB(),
          fitFOV:   45,
          duration: 0.7,
          arc:      true,
          easing:   "inThenOut",
        });
      }
    },
  ];
}
