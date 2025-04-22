#!/usr/bin/env node
import '@loaders.gl/polyfills';
import { SceneModel } from "../scene";
import { convertMetaModel } from "../metamodel";
/**
 * @private
 */
declare function ifc2gltf2xgf(params: {
    fileData: ArrayBuffer;
    xgfVersion?: number;
}): Promise<{
    xgfArrayBuffer: ArrayBuffer;
    sceneModel: SceneModel;
}>;
/**
 * @private
 */
export { ifc2gltf2xgf };
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
//# sourceMappingURL=ifc2gltf2xgf.d.ts.map