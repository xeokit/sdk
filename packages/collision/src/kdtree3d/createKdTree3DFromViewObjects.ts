import {ViewObject} from "@xeokit/viewer";
import {KdTree3D} from "./KdTree3D";
import {collapseAABB3, expandAABB3} from "@xeokit/math/boundaries";

/**
 * TODO
 * @param viewObjects
 */
export function createKdTree3DFromViewObjects(viewObjects: ViewObject[]): KdTree3D {
    const aabb = collapseAABB3();
    for (let i = 0, len = viewObjects.length; i < len; i++) {
        const viewObject = viewObjects[i];
        expandAABB3(aabb, viewObject.aabb);
    }
    const kdTree = new KdTree3D({aabb});
    for (let i = 0, len = viewObjects.length; i < len; i++) {
        const viewObject = viewObjects[i];
        kdTree.insertItem(viewObject, viewObject.aabb);
    }
    return kdTree;
}

