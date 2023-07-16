const path = require('path');

module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    moduleNameMapper: {

        "@xeokit/data/(.*)$": path.join(__dirname, "../data/src/$1"),
        "@xeokit/core(.*)$": path.join(__dirname, "../core/src/$1"),
        "@xeokit/utils(.*)$": path.join(__dirname, "../utils/src/$1"),
        "@xeokit/constants(.*)$": path.join(__dirname, "../constants/src/$1"),
        "@xeokit/math(.*)$": path.join(__dirname, "../math/src/$1"),
        "@xeokit/boundaries(.*)$": path.join(__dirname, "../boundaries/src/"),
        "@xeokit/curves(.*)$": path.join(__dirname, "../curves$1/src/$1"),
        "@xeokit/frustum(.*)$": path.join(__dirname, "../frustum$1/src/$1"),
        "@xeokit/compression(.*)$": path.join(__dirname, "../compression/src/$1"),
        "@xeokit/matrix(.*)$": path.join(__dirname, "../matrix/src/$1"),
        "@xeokit/ray(.*)$": path.join(__dirname, "../ray/src/$1"),
        "@xeokit/rtc(.*)$": path.join(__dirname, "../rtc/src/$1"),

        //
        // "@xeokit/rtc": ["math/src/rtc"],
        // "@xeokit/viewer": ["viewer/src"],
        // "@xeokit/webglutils": ["webglutils/src"],
        // "@xeokit/webglrenderer": ["webglrenderer/src"],

        "@xeokit/basictypes/basicTypes": path.join(__dirname, "../datatypes/src/basicTypes"),
        "@xeokit/ifctypes(.*)$": path.join(__dirname, "../datatypes/src/ifcTypes"),
        //
        // "@xeokit/xkt": ["xkt/src"],
        // "@xeokit/las": ["las/src"],
        // "@xeokit/gltf": ["gltf/src"],
        // "@xeokit/locale": ["locale/src"],
        // "@xeokit/compression": ["compression/src"],
        // "@xeokit/procgen": ["procgen/src/geometry"],
        // "@xeokit/ktx2": ["ktx2/src"],
        // "@xeokit/bcf": ["bcf/src"],
        // "@xeokit/controls": ["controls/src"],
        // "@xeokit/scene": ["scene/src"],
//        "@xeokit/treeview": ["treeview/src"]
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    resolver: undefined,
    silent: false
};