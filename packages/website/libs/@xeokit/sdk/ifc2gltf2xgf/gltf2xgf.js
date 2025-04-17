#!/usr/bin/env node
import '@loaders.gl/polyfills';
import { Scene } from "../scene";
import { SDKError } from "../core";
import { GLTFLoader } from "../gltf";
import { XKFWriter, SAVED_XGF_VERSIONS, DEFAULT_SAVED_XGF_VERSION } from "../xgf";
import { convertMetaModel } from "../metamodel";
/**
 * @private
 */
function gltf2xgf(params) {
    const { fileData, xgfVersion } = params;
    return new Promise(function (resolve, reject) {
        const scene = new Scene();
        const sceneModel = scene.createModel({
            id: "foo"
        });
        if (sceneModel instanceof SDKError) {
            return reject(sceneModel.message);
        }
        else {
            GLTFLoader({ fileData, sceneModel })
                .then(() => {
                sceneModel.build()
                    .then(() => {
                    const xgfArrayBuffer = XKFWriter.write({ sceneModel, xgfVersion });
                    if (xgfArrayBuffer instanceof SDKError) {
                        return reject(xgfArrayBuffer.message);
                    }
                    else {
                        return resolve({ xgfArrayBuffer, sceneModel });
                    }
                }).catch(err => {
                    return reject(err);
                });
            }).catch(err => {
                return reject(err);
            });
        }
    });
}
/**
 * @private
 */
export { gltf2xgf };
/**
 * @private
 */
export const _SAVED_XGF_VERSIONS = SAVED_XGF_VERSIONS; // Make these private for our CLI tool's use only
/**
 * @private
 */
export const _DEFAULT_SAVED_XGF_VERSION = DEFAULT_SAVED_XGF_VERSION;
/**
 * @private
 */
export const _convertMetaModel = convertMetaModel;
//# sourceMappingURL=gltf2xgf.js.map
