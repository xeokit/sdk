#!/usr/bin/env node
import { DataModel } from "../data";
import { SceneModel } from "../scene";
/**
 * @private
 */
declare function cityjson2xgf(params: {
    fileData: any;
    xgfVersion?: number;
    createDataModel?: boolean;
}): Promise<{
    xgfArrayBuffer: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
    dataModelParams: any;
}>;
/**
 *
 */
export { cityjson2xgf };
/**
 * @private
 */
export declare const _SAVED_XGF_VERSIONS: number[];
/**
 * @private
 */
export declare const _DEFAULT_SAVED_XGF_VERSION: number;
//# sourceMappingURL=cityjson2xgf.d.ts.map