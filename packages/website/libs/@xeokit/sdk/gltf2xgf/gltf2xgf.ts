#!/usr/bin/env node

import '@loaders.gl/polyfills';
import {Data, DataModel} from "../data";
import {Scene, SceneModel} from "../scene";
import {SDKError} from "../core";
import {loadGLTF} from "../gltf";
import {saveXGF, SAVED_XGF_VERSIONS, DEFAULT_SAVED_XGF_VERSION} from "../xgf";

/**
 * @private
 */
function gltf2xgf(params: {
    fileData: ArrayBuffer,
    xgfVersion?: number,
    createDataModel?: boolean
}): Promise<{
    xgfArrayBuffer: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    dataModelParams: any
}> {
    const {fileData, xgfVersion, createDataModel} = params;
    return new Promise(function (resolve, reject) {
        const scene = new Scene();
        const sceneModel = scene.createModel({
            id: "foo"
        });
        if (sceneModel instanceof SDKError) {
            return reject(sceneModel.message);
        } else {
            if (createDataModel) { // Create default DataModel from glTF
                const data = new Data();
                const dataModel = data.createModel({
                    id: "foo"
                });
                if (dataModel instanceof SDKError) {
                    return reject(dataModel.message);
                } else {
                    loadGLTF({
                        fileData,
                        dataModel,
                        sceneModel
                    }).then(() => {
                        sceneModel.build().then(() => {
                            dataModel.build().then(() => {
                                const xgfArrayBuffer = saveXGF({
                                    sceneModel,
                                    xgfVersion
                                });
                                if (xgfArrayBuffer instanceof SDKError) {
                                    return reject(xgfArrayBuffer.message);
                                } else {
                                    const dataModelParams = dataModel.toParams();
                                    return resolve({
                                        xgfArrayBuffer,
                                        sceneModel,
                                        dataModel,
                                        dataModelParams
                                    });
                                }
                            }).catch(reason => {
                                return reject(reason);
                            });
                        }).catch((reason) => {
                            return reject(reason);
                        });
                    }).catch((reason) => {
                        return reject(reason);
                    });
                }
            } else {   // Don't create DataModel
                loadGLTF({
                    fileData,
                    sceneModel
                }).then(() => {
                    sceneModel.build().then(() => {
                        const xgfArrayBuffer = saveXGF({
                            sceneModel,
                            xgfVersion
                        });
                        if (xgfArrayBuffer instanceof SDKError) {
                            return reject(xgfArrayBuffer.message);
                        } else {
                            return resolve({
                                xgfArrayBuffer,
                                sceneModel,
                                dataModel: null,
                                dataModelParams: null
                            });
                        }
                    }).catch(err => {
                        return reject(err);
                    });
                }).catch(err => {
                    return reject(err);
                });
            }
        }
    });
}

/**
 * @private
 */
export {gltf2xgf};

/**
 * @private
 */
export const _SAVED_XGF_VERSIONS = SAVED_XGF_VERSIONS; // Make these private for our CLI tool's use only

/**
 * @private
 */
export const _DEFAULT_SAVED_XGF_VERSION = DEFAULT_SAVED_XGF_VERSION;
