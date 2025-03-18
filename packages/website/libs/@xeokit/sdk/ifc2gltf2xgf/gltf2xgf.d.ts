#!/usr/bin/env node
import '@loaders.gl/polyfills';
import { SceneModel } from "../scene";
import { convertMetaModel } from "../metamodel";
/**
 * @private
 */
declare function gltf2xgf(params: {
    fileData: ArrayBuffer;
    xgfVersion?: number;
}): Promise<{
    xgfArrayBuffer: ArrayBuffer;
    sceneModel: SceneModel;
}>;
/**
 * @private
 */
export { gltf2xgf };
/**
 * @private
 */
export declare const _SAVED_XGF_VERSIONS: number[];
/**
 * @private
 */
export declare const _DEFAULT_SAVED_XGF_VERSION: number;
/**
 * @private
 */
export declare const _convertMetaModel: typeof convertMetaModel;
//# sourceMappingURL=gltf2xgf.d.ts.map