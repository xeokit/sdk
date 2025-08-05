#!/usr/bin/env node

import '@loaders.gl/polyfills';
import type {SceneModel} from "../scene/SceneModel";
import {Scene} from "../scene";
import {convertMetaModel} from "../metamodel";
import {GLTFLoader} from "../gltf";
import {SDKError} from "../core";
import {XGFExporter} from "../xgf";

const xgfExporter = new XGFExporter();

/**
 * @private
 */
function ifc2gltf2xgf(params: {
  fileData: ArrayBuffer,
  xgfVersion?: string
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
      (new GLTFLoader()).load({fileData, sceneModel})
        .then(() => {
          xgfExporter.write({
            sceneModel,
            version: xgfVersion
          })
            .then(xgfArrayBuffer => {
              return resolve({
                xgfArrayBuffer,
                sceneModel
              });
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
export const _SAVED_XGF_VERSIONS = xgfExporter.versions; // Make these private for our CLI tool's use only

/**
 * @private
 */
export const _DEFAULT_SAVED_XGF_VERSION = xgfExporter.defaultVersion;

/**
 * @private
 */
export const _convertMetaModel = convertMetaModel;
