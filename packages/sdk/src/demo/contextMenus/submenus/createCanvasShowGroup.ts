/**
 * Canvas-side counterpart of {@link createViewObjectShowGroup} —
 * scene-wide resets only since there's no specific
 * {@link ViewObject} to act on.
 *
 * @module demo/viewObjectContextMenu/submenus/createCanvasShowGroup
 */

import type {CanvasContextMenuContext} from "../CanvasContextMenuContext";


export function createCanvasShowGroup() {
  return {
    getTitle: () => "Show",
    items: [
      [
        {
          getTitle: () => "Show All",
          getEnabled: (context: CanvasContextMenuContext) => {
            const {view} = context;
            return view.numVisibleObjects < view.numObjects || view.numXRayedObjects > 0;
          },
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsPickable(view.xrayedObjectIds, true);
            view.setObjectsXRayed(view.xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Hide All",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numVisibleObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            context.view.setObjectsVisible(context.view.visibleObjectIds, false);
          }
        },
        {
          getTitle: () => "X-Ray All",
          getEnabled: (context: CanvasContextMenuContext) =>
            context.view.numXRayedObjects < context.view.numObjects,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsXRayed(view.objectIds, true);
          }
        },
        {
          getTitle: () => "Clear X-Ray",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numXRayedObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            const {xrayedObjectIds} = view;
            view.setObjectsPickable(xrayedObjectIds, true);
            view.setObjectsXRayed(xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear Selection",
          getEnabled: (context: CanvasContextMenuContext) => context.view.numSelectedObjects > 0,
          doAction: (context: CanvasContextMenuContext) => {
            context.view.setObjectsSelected(context.view.selectedObjectIds, false);
          }
        },
      ],
    ],
  };
}
