/**
 * Tiny resolvers for objects and AABBs reached off a menu context.
 *
 * Centralised so the submenu builders do not need to know the
 * shape of {@link BaseViewContext} / {@link ViewObjectContextMenuContext}
 * past the surface this file presents — the menus depend on
 * "I have a view-object context", and these helpers depend on
 * "I have a scene / data model on it".
 *
 * @module studio/viewObjectContextMenu/helpers/sceneRefs
 */

import type {AABB3} from "@xeokit/sdk/base/math/boundaries";
import type {SceneObject} from "@xeokit/sdk/model/scene";
import type {DataObject} from "@xeokit/sdk/model/data";
import type {BaseViewContext} from "../BaseViewContext";
import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";


/** Combined AABB of every object in the current SceneModel. */
export function getSceneModelAABB(context: BaseViewContext): AABB3 {
  return context.collisionIndex.getCombinedObjectAABB(
    Object.keys(context.sceneModel.objects)
  );
}

/** Currently-targeted SceneObject. */
export function getCurrentSceneObject(context: ViewObjectContextMenuContext): SceneObject {
  return context.viewObject.sceneObject;
}

/**
 * Currently-targeted DataObject, or `undefined` when the context
 * has no associated DataModel (e.g. a model loaded without
 * semantics).
 */
export function getCurrentDataObject(context: ViewObjectContextMenuContext): DataObject | undefined {
  if (!context.dataModel) {
    return undefined;
  }
  return context.dataModel.objects[context.viewObject.sceneObject.id];
}
