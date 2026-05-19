/**
 * Builds the **Modify** submenu — non-destructive mutations on
 * the targeted object's parent SceneModel. Replaces the old
 * "Effects" submenu (which was a junk drawer with IFC materials
 * + demolish) and the standalone top-level "Change Material" item.
 *
 * "Modify" is honest about what these do (mutate scene state);
 * the old "Effects" name suggested visual filters.
 *
 * @module demo/viewObjectContextMenu/submenus/createViewObjectModifyGroup
 */

import {SchemaMaterialsPanel} from "../../panels/schemaMaterialsPanel/SchemaMaterialsPanel";
import {applyIFCMaterials} from "../../systems/applyIFCMaterials";
import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";
import {createCategorySubmenus} from "./createCategorySubmenus";


export function createViewObjectModifyGroup() {
  return {
    getTitle: () => "Modify",
    items: [
      [
        {
          getTitle: () => "Change Material",
          items: [createCategorySubmenus()],
        },
      ],
      [
        {
          getTitle: () => "Add IFC Materials",
          getEnabled: (context: ViewObjectContextMenuContext) => !!context.dataModel,
          doAction: async (context: ViewObjectContextMenuContext) => {
            const sceneModel = context.viewObject.sceneObject.model;
            const dataModel = context.dataModel;
            if (!dataModel) {
              console.warn("[ViewObjectContextMenu] Add IFC Materials: no DataModel in context");
              return;
            }
            const result = await applyIFCMaterials({sceneModel, dataModel});
            if (result.ok === false) {
              console.error("[ViewObjectContextMenu] Add IFC Materials failed:", result.error);
            }
          }
        },
        {
          title: "Schema Materials…",
          icon: SchemaMaterialsPanel.iconSvg(),
          getEnabled: (context: ViewObjectContextMenuContext) => !!context.dataModel,
          doAction: (context: ViewObjectContextMenuContext) => {
            context.studio.panels.open("schemaMaterials", {
              focusSceneModel: context.viewObject.sceneObject.model,
            });
          }
        },
        {
          getTitle: () => "Demolish Model",
          doAction: async (context: ViewObjectContextMenuContext) => {
            const result = await context.studio.demolishModel(context.viewObject.sceneObject.model);
            if (result.ok === false) {
              console.error(result.error);
            }
          }
        }
      ]
    ]
  };
}
