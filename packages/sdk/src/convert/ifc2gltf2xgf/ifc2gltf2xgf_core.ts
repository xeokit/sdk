#!/usr/bin/env node

import '@loaders.gl/polyfills';
import type {SceneModel} from "../../model/scene/SceneModel";
import {Scene} from "../../model/scene";
import {convertMetaModel} from "../../formats/legacy/metamodel";
import {GLTFLoader} from "../../formats/gltf";
import {XGFExporter} from "../../formats/xgf";

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
    const sceneModelResult = scene.createModel({
      id: "foo"
    });
    if (sceneModelResult.ok===false) {
      return reject(sceneModelResult.error);
    } else {
        const sceneModel = sceneModelResult.value;
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
