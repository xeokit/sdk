import {SceneObject} from "@xeokit/core/components";
import {MeshImpl} from "./MeshImpl";
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * @private
 */
export class ObjectImpl implements SceneObject {

    id: string;

    meshes: MeshImpl[];

    constructor(cfg: {
        meshes: MeshImpl[];
        id: string;
    }) {
        this.id = cfg.id;
        this.meshes = cfg.meshes;
    }

    get aabb(): FloatArrayParam {
        return undefined;
    }
}
