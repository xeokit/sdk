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
var dotbim2xgf_exports = {};
__export(dotbim2xgf_exports, {
  _DEFAULT_SAVED_XGF_VERSION: () => _DEFAULT_SAVED_XGF_VERSION,
  _SAVED_XGF_VERSIONS: () => _SAVED_XGF_VERSIONS,
  dotbim2xgf: () => dotbim2xgf
});
module.exports = __toCommonJS(dotbim2xgf_exports);
var import_data = require("../data");
var import_scene = require("../scene");
var import_core = require("../core");
var import_dotbim = require("../dotbim");
var import_xgf = require("../xgf");
function dotbim2xgf(params) {
  const { fileData, xgfVersion, createDataModel } = params;
  return new Promise(function(resolve, reject) {
    const scene = new import_scene.Scene();
    const sceneModel = scene.createModel({
      id: "foo"
    });
    if (sceneModel instanceof import_core.SDKError) {
      return reject(sceneModel.message);
    } else {
      if (createDataModel) {
        const data = new import_data.Data();
        const dataModel = data.createModel({
          id: "foo"
        });
        if (dataModel instanceof import_core.SDKError) {
          return reject(dataModel.message);
        } else {
          (0, import_dotbim.loadDotBIM)({
            fileData,
            dataModel,
            sceneModel
          }).then(() => {
            sceneModel.build().then(() => {
              dataModel.build().then(() => {
                const xgfArrayBuffer = (0, import_xgf.saveXGF)({
                  sceneModel,
                  xgfVersion
                });
                if (xgfArrayBuffer instanceof import_core.SDKError) {
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
              }).catch((reason) => {
                return reject(reason);
              });
            }).catch((reason) => {
              return reject(reason);
            });
          }).catch((reason) => {
            return reject(reason);
          });
        }
      } else {
        (0, import_dotbim.loadDotBIM)({
          fileData,
          sceneModel
        }).then(() => {
          sceneModel.build().then(() => {
            const xgfArrayBuffer = (0, import_xgf.saveXGF)({
              sceneModel,
              xgfVersion
            });
            if (xgfArrayBuffer instanceof import_core.SDKError) {
              return reject(xgfArrayBuffer.message);
            } else {
              return resolve({
                xgfArrayBuffer,
                sceneModel,
                dataModel: null,
                dataModelParams: null
              });
            }
          }).catch((err) => {
            return reject(err);
          });
        }).catch((err) => {
          return reject(err);
        });
      }
    }
  });
}
const _SAVED_XGF_VERSIONS = import_xgf.SAVED_XGF_VERSIONS;
const _DEFAULT_SAVED_XGF_VERSION = import_xgf.DEFAULT_SAVED_XGF_VERSION;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  _DEFAULT_SAVED_XGF_VERSION,
  _SAVED_XGF_VERSIONS,
  dotbim2xgf
});
