"use strict";

const path = require("path");

const SDK_SRC_DIR = path.resolve(__dirname, "..", "..", "..", "sdk", "src");

function sdkPath(modulePath) {
  return path.join(SDK_SRC_DIR, modulePath.replace(/^[/\\]+/, ""));
}

function sdkRequire(modulePath) {
  return require(require.resolve(sdkPath(modulePath), {
    paths: [SDK_SRC_DIR]
  }));
}

module.exports = {
  SDK_SRC_DIR,
  sdkPath,
  sdkRequire
};
