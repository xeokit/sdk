#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var ifc2gltf2xgf_exports = {};
__export(ifc2gltf2xgf_exports, {
  _DEFAULT_SAVED_XGF_VERSION: () => _DEFAULT_SAVED_XGF_VERSION,
  _SAVED_XGF_VERSIONS: () => _SAVED_XGF_VERSIONS,
  _convertMetaModel: () => _convertMetaModel,
  ifc2gltf2xgf: () => ifc2gltf2xgf
});
module.exports = __toCommonJS(ifc2gltf2xgf_exports);
var import_polyfills = require("@loaders.gl/polyfills");
var import_scene = require("../scene");
var import_core = require("../core");
var import_gltf = require("../gltf");
var import_xgf = require("../xgf");
var import_metamodel = require("../metamodel");
function ifc2gltf2xgf(params) {
  const { fileData, xgfVersion } = params;
  return new Promise(function(resolve, reject) {
    const scene = new import_scene.Scene();
    const sceneModel = scene.createModel({
      id: "foo"
    });
    if (sceneModel instanceof import_core.SDKError) {
      return reject(sceneModel.message);
    } else {
      (0, import_gltf.GLTFLoader)({ fileData, sceneModel }).then(() => {
        sceneModel.build().then(() => {
          const xgfArrayBuffer = (0, import_xgf.XKFWriter)({ sceneModel, xgfVersion });
          if (xgfArrayBuffer instanceof import_core.SDKError) {
            return reject(xgfArrayBuffer.message);
          } else {
            return resolve({ xgfArrayBuffer, sceneModel });
          }
        }).catch((err) => {
          return reject(err);
        });
      }).catch((err) => {
        return reject(err);
      });
    }
  });
}
const _SAVED_XGF_VERSIONS = import_xgf.SAVED_XGF_VERSIONS;
const _DEFAULT_SAVED_XGF_VERSION = import_xgf.DEFAULT_SAVED_XGF_VERSION;
const _convertMetaModel = import_metamodel.convertMetaModel;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  _DEFAULT_SAVED_XGF_VERSION,
  _SAVED_XGF_VERSIONS,
  _convertMetaModel,
  ifc2gltf2xgf
});
