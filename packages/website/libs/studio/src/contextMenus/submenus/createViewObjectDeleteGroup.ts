/**
 * Builds the trailing **Delete** group — destructive actions
 * placed last so the implicit group-separator above them acts as
 * a visual moat against accidental clicks. Two flat items rather
 * than a submenu so the click count stays low when the user
 * really wants to delete.
 *
 * @module studio/viewObjectContextMenu/submenus/createViewObjectDeleteGroup
 */

import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";


export function createViewObjectDeleteGroup() {
  return [
    {
      getTitle: () => "Delete Object",
      doAction: (context: ViewObjectContextMenuContext) => {
        context.viewObject.sceneObject.destroy();
      }
    },
    {
      getTitle: () => "Delete Model",
      doAction: (context: ViewObjectContextMenuContext) => {
        // Defer to Studio so the matching DataModel goes
        // away too — destroying just the SceneModel here would
        // leave its DataObjects hanging around in `Data` and
        // every panel that walks the data graph would still
        // show them.
        const id = context.viewObject.sceneObject.model.id;
        context.studio.destroyModel(id);
      }
    }
  ];
}
