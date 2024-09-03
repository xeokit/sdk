#!/usr/bin/env node

import '@loaders.gl/polyfills';
import {Data, DataModel} from "@xeokit/data";
import {Scene, SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {loadWebIFC} from "@xeokit/webifc";
import {saveDTX, SAVED_DTX_VERSIONS, DEFAULT_SAVED_DTX_VERSION} from "@xeokit/dtx";

/**
 * @private
 */
function webifc2dtx(params: {
    ifcAPI: any,
    fileData: ArrayBuffer,
    dtxVersion?: number,
    createDataModel?: boolean
}): Promise<{
    dtxArrayBuffer: ArrayBuffer,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    dataModelJSON: any
}> {
    const {ifcAPI, fileData, dtxVersion, createDataModel} = params;
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
                                const dtxArrayBuffer = saveDTX({
                                    sceneModel,
                                    dtxVersion
                                });
                                if (dtxArrayBuffer instanceof SDKError) {
                                    return reject(dtxArrayBuffer.message);
                                } else {
                                    const dataModelJSON = dataModel.getJSON();
                                    return resolve({
                                        dtxArrayBuffer,
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
                        const dtxArrayBuffer = saveDTX({
                            sceneModel,
                            dtxVersion
                        });
                        if (dtxArrayBuffer instanceof SDKError) {
                            return reject(dtxArrayBuffer.message);
                        } else {
                            return resolve({
                                dtxArrayBuffer,
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
export {webifc2dtx};

/**
 * @private
 */
export const _SAVED_DTX_VERSIONS = SAVED_DTX_VERSIONS; // Make these private for our CLI tool's use only

/**
 * @private
 */
export const _DEFAULT_SAVED_DTX_VERSION = DEFAULT_SAVED_DTX_VERSION;
