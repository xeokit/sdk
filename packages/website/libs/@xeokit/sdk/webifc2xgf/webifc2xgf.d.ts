#!/usr/bin/env node
import '@loaders.gl/polyfills';
import { DataModel } from "../data";
import { SceneModel } from "../scene";
/**
 * @private
 */
declare function webifc2xgf(params: {
    ifcAPI: any;
    fileData: ArrayBuffer;
    xgfVersion?: number;
    createDataModel?: boolean;
}): Promise<{
    xgfArrayBuffer: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
    dataModelParams: any;
}>;
/**
 * @private
 */
export { webifc2xgf };
/**
 * @private
 */
export declare const _SAVED_XGF_VERSIONS: number[];
/**
 * @private
 */
export declare const _DEFAULT_SAVED_XGF_VERSION: number;
//# sourceMappingURL=webifc2xgf.d.ts.map