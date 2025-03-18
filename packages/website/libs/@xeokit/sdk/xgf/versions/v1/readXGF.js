import { unpackXGF } from "./unpackXGF";
import { xgfToModel } from "./xgfToModel";
/**
 * @private
 */
export function readXGF(params) {
    const { fileData, sceneModel, dataModel } = params;
    xgfToModel({
        xgfData: unpackXGF(fileData),
        sceneModel,
        dataModel
    });
}
//# sourceMappingURL=readXGF.js.map