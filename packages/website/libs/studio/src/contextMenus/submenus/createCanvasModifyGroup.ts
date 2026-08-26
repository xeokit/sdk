/**
 * Canvas-side **Modify** submenu — scene-level mutators that
 * don't need a specific object pick. Mirrors the entries in
 * {@link createViewObjectModifyGroup} that still make sense
 * without a {@link viewing!viewer.ViewObject | ViewObject} target.
 *
 * @module studio/viewObjectContextMenu/submenus/createCanvasModifyGroup
 */

import {SchemaMaterialsPanel} from "../../panels/schemaMaterialsPanel/SchemaMaterialsPanel";
import type {CanvasContextMenuContext} from "../CanvasContextMenuContext";


export function createCanvasModifyGroup() {
  return {
    getTitle: () => "Modify",
    items: [
      [
        {
          title: "Schema Materials…",
          icon: SchemaMaterialsPanel.iconSvg(),
          getEnabled: (context: CanvasContextMenuContext) => !!context.dataModel,
          doAction: (context: CanvasContextMenuContext) => {
            context.studio.panels.open("schemaMaterials", {focusSceneModel: context.sceneModel});
          }
        }
      ]
    ]
  };
}
