#!/usr/bin/env node

import '@loaders.gl/polyfills';
import {Data, DataModel} from "@xeokit/data";
import {Scene, SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {loadWebIFC} from "@xeokit/webifc";
import {saveXGF, SAVED_XGF_VERSIONS, DEFAULT_SAVED_XGF_VERSION} from "@xeokit/xgf";

/**
 * @private
 */
function webifc2xgf(params: {
    ifcAPI: any,
    fileData: ArrayBuffer,
    xgfVersion?: number,
    createDataModel?: boolean
}): Promise<{
    xgfArrayBuffer: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    dataModelJSON: any
}> {
    const {ifcAPI, fileData, xgfVersion, createDataModel} = params;
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
                    loadWebIFC({
                        ifcAPI,
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
                                    const dataModelJSON = dataModel.getJSON();
                                    return resolve({
                                        xgfArrayBuffer,
                                        sceneModel,
                                        dataModel,
                                        dataModelJSON
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
                loadWebIFC({
                    ifcAPI,
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
                                dataModelJSON: null
                            });
                        }
                    }).catch(reason => {
                        return reject(reason);
                    });
                }).catch((reason) => {
                    return reject(reason);
                });
            }
        }
    });
}

/**
 * @private
 */
export {webifc2xgf};

/**
 * @private
 */
export const _SAVED_XGF_VERSIONS = SAVED_XGF_VERSIONS; // Make these private for our CLI tool's use only

/**
 * @private
 */
export const _DEFAULT_SAVED_XGF_VERSION = DEFAULT_SAVED_XGF_VERSION;