#!/usr/bin/env node
import { DataModel } from "../data";
import { SceneModel } from "../scene";
/**
 * @private
 */
declare function dotbim2xgf(params: {
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
export { dotbim2xgf };
/**
 * @private
 */
export declare const _SAVED_XGF_VERSIONS: number[];
/**
 * @private
 */
export declare const _DEFAULT_SAVED_XGF_VERSION: number;
//# sourceMappingURL=dotbim2xgf.d.ts.map