import {Mesh, XKTObject} from "@xeokit/core/components";

/**
 * @private
 */
export class ObjectImpl implements XKTObject {

    objectId: string;
    meshes: Mesh[];

    constructor(cfg: any) {
        this.objectId = cfg.objectId;
        this.meshes = cfg.meshes;
    }
}
