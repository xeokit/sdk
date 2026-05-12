/**
 * Builds the per-category submenu list used by the "Change
 * Material" entry inside the **Modify** submenu.
 *
 * Walks the shared {@link MaterialsPalette} catalog, groups
 * entries by their {@link PainterCatalogEntry.category}, and
 * emits one submenu item per non-empty category with the painters
 * as actions inside it. Display order is fixed (Masonry → Interior
 * → Metals → Glass) so the menu reads the same regardless of
 * catalog declaration order.
 *
 * @module demo/viewObjectContextMenu/submenus/createCategorySubmenus
 */

import type {PainterCatalogEntry} from "../../systems/materials";
import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";
import {getMaterialsPalette} from "../helpers/getMaterialsPalette";


export function createCategorySubmenus() {
  const palette = getMaterialsPalette();
  const byCategory: Record<string, PainterCatalogEntry[]> = {};
  for (const entry of palette.catalog) {
    (byCategory[entry.category] ||= []).push(entry);
  }

  // Catalog enum values are singular; the user-visible labels follow
  // the more natural plural for "Metals". Order is fixed so menu
  // structure stays stable across catalog reshuffling.
  const order: ReadonlyArray<{cat: PainterCatalogEntry["category"]; label: string}> = [
    {cat: "Masonry",  label: "Masonry"},
    {cat: "Interior", label: "Interior"},
    {cat: "Metal",    label: "Metals"},
    {cat: "Glass",    label: "Glass"},
  ];

  return order
    .filter(({cat}) => byCategory[cat] && byCategory[cat].length > 0)
    .map(({cat, label}) => ({
      getTitle: () => label,
      items: [
        byCategory[cat].map(entry => ({
          getTitle: () => entry.label,
          doAction: (context: ViewObjectContextMenuContext) => {
            const sceneObject = context.viewObject.sceneObject;
            const meshIds = sceneObject.meshes.map(m => m.id);
            const sceneModel = sceneObject.model;
            for (const meshId of meshIds) {
              const mesh = sceneModel.meshes[meshId];
              if (!mesh) {
                continue;
              }
              const result = palette.paintMaterial(mesh, entry.id);
              if (result.ok === false) {
                console.error(`[ViewObjectContextMenu] Change Material '${entry.id}' on mesh '${meshId}' failed:`, result.error);
              }
            }
          },
        })),
      ],
    }));
}
