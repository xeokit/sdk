import { inflateXKT } from "./inflateXKT";
import { unpackXKT } from "./unpackXKT";
import { xktToModel } from "./xktToModel";
export function parseXKTv10(params) {
    const { fileData, sceneModel } = params;
    if (sceneModel.destroyed) {
        return Promise.reject("SceneModel already destroyed");
    }
    if (sceneModel.built) {
        return Promise.reject("SceneModel already built");
    }
    xktToModel({
        xktData: inflateXKT(unpackXKT(fileData)),
        sceneModel
    });
    return Promise.resolve();
}
//# sourceMappingURL=parseXKT.js.map