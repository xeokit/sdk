/**
 * Builds the **Show** submenu — visibility / x-ray / selection
 * actions, flattened from the old 3-deep `Display → {Visibility,
 * X-Ray, Selection}` tree into one submenu with a separator
 * between per-object actions and scene-wide resets.
 *
 * Per-object actions read as a vertical menu of toggles; the
 * Select / Deselect entry uses a dynamic title rather than two
 * mutually-disabled rows so the user always sees the action that
 * actually applies right now.
 *
 * @module demo/viewObjectContextMenu/submenus/createViewObjectShowGroup
 */

import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";


export function createViewObjectShowGroup() {
  return {
    getTitle: () => "Show",
    items: [
      // Per-object actions.
      [
        {
          getTitle: () => "Hide",
          getEnabled: (context: ViewObjectContextMenuContext) => context.viewObject.visible,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.viewObject.visible = false;
          }
        },
        {
          getTitle: () => "Isolate",
          doAction: (context: ViewObjectContextMenuContext) => {
            const {viewObject} = context;
            const {view} = viewObject;
            view.setObjectsVisible(view.visibleObjectIds, false);
            viewObject.visible = true;
          }
        },
        {
          getTitle: () => "X-Ray Object",
          getEnabled: (context: ViewObjectContextMenuContext) => !context.viewObject.xrayed,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.viewObject.xrayed = true;
          }
        },
        {
          getTitle: () => "X-Ray Others",
          doAction: (context: ViewObjectContextMenuContext) => {
            const {viewObject} = context;
            const {view} = viewObject;
            view.setObjectsXRayed(view.objectIds, true);
            viewObject.xrayed = false;
          }
        },
        {
          // Single dynamic toggle instead of two rows where one
          // is always disabled — fewer visual distractions.
          getTitle: (context: ViewObjectContextMenuContext) =>
            context.viewObject.selected ? "Deselect" : "Select",
          doAction: (context: ViewObjectContextMenuContext) => {
            context.viewObject.selected = !context.viewObject.selected;
          }
        },
      ],
      // Scene-wide resets.
      [
        {
          getTitle: () => "Show All",
          getEnabled: (context: ViewObjectContextMenuContext) => {
            const {view} = context;
            return view.numVisibleObjects < view.numObjects || view.numXRayedObjects > 0;
          },
          doAction: (context: ViewObjectContextMenuContext) => {
            const {view} = context;
            view.setObjectsVisible(view.objectIds, true);
            view.setObjectsPickable(view.xrayedObjectIds, true);
            view.setObjectsXRayed(view.xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear X-Ray",
          getEnabled: (context: ViewObjectContextMenuContext) => context.view.numXRayedObjects > 0,
          doAction: (context: ViewObjectContextMenuContext) => {
            const {view} = context;
            const {xrayedObjectIds} = view;
            view.setObjectsPickable(xrayedObjectIds, true);
            view.setObjectsXRayed(xrayedObjectIds, false);
          }
        },
        {
          getTitle: () => "Clear Selection",
          getEnabled: (context: ViewObjectContextMenuContext) => context.view.numSelectedObjects > 0,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.view.setObjectsSelected(context.view.selectedObjectIds, false);
          }
        },
      ],
    ],
  };
}
