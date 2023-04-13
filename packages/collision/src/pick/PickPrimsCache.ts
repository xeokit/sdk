import {KdTree3D} from "../kdtree3d";
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * TODO
 */
export class PickPrimsCache {
    primitivesKdTrees: {
        [key: string]: {
            primitivesKdTree: KdTree3D,
            positions: FloatArrayParam
        }
    };

    constructor() {
        this.primitivesKdTrees = {};
    }

    clear() {
        this.primitivesKdTrees = {};
    }
}