#!/usr/bin/env node

import '@loaders.gl/polyfills';
import {Scene, SceneModel} from "../scene";
import {SDKError} from "../core";
import {loadGLTF} from "../gltf";
import {saveXGF, SAVED_XGF_VERSIONS, DEFAULT_SAVED_XGF_VERSION} from "../xgf";
import {convertMetaModel} from "../metamodel";

/**
 * @private
 */
function ifc2gltf2xgf(params: {
    fileData: ArrayBuffer,
    xgfVersion?: number
}): Promise<{
    xgfArrayBuffer: ArrayBuffer,
    sceneModel: SceneModel
}> {
    const {fileData, xgfVersion} = params;
    return new Promise(function (resolve, reject) {
        const scene = new Scene();
        const sceneModel = scene.createModel({
            id: "foo"
        });
        if (sceneModel instanceof SDKError) {
            return reject(sceneModel.message);
        } else {
            loadGLTF({fileData, sceneModel})
                .then(() => {
                    sceneModel.build()
                        .then(() => {
                            const xgfArrayBuffer = saveXGF({sceneModel, xgfVersion});
                            if (xgfArrayBuffer instanceof SDKError) {
                                return reject(xgfArrayBuffer.message);
                            } else {
                                return resolve({xgfArrayBuffer, sceneModel});
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
export {ifc2gltf2xgf};

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
