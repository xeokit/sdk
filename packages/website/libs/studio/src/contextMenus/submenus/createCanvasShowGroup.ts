/**
 * Canvas-side counterpart of {@link createViewObjectShowGroup} —
 * scene-wide resets only since there's no specific
 * {@link viewing!viewer.ViewObject | ViewObject} to act on.
 *
 * @module studio/viewObjectContextMenu/submenus/createCanvasShowGroup
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
            return view.numVisibleObjects < view.numObjects || view.styleBins.getObjectIds("xrayed").length > 0;
          },
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            const xrayedObjectIds = view.styleBins.getObjectIds("xrayed");
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsPickable([...xrayedObjectIds], true);
            view.setObjectsInStyleBin("xrayed", xrayedObjectIds, false);
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
            context.view.styleBins.getObjectIds("xrayed").length < context.view.numObjects,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsInStyleBin("xrayed", view.objectIds, true);
          }
        },
        {
          getTitle: () => "Clear X-Ray",
          getEnabled: (context: CanvasContextMenuContext) => context.view.styleBins.getObjectIds("xrayed").length > 0,
          doAction: (context: CanvasContextMenuContext) => {
            const {view} = context;
            const xrayedObjectIds = view.styleBins.getObjectIds("xrayed");
            view.setObjectsPickable([...xrayedObjectIds], true);
            view.setObjectsInStyleBin("xrayed", xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear Selection",
          getEnabled: (context: CanvasContextMenuContext) => context.view.styleBins.getObjectIds("selected").length > 0,
          doAction: (context: CanvasContextMenuContext) => {
            context.view.setObjectsInStyleBin("selected", context.view.styleBins.getObjectIds("selected"), false);
          }
        },
      ],
    ],
  };
}
