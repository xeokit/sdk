const path = require('path');

module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    moduleNameMapper: {

        "@xeokit/data/(.*)$": path.join(__dirname, "../data/src/$1"),
        "@xeokit/core/components(.*)$": path.join(__dirname, "../core/src/components$1"),
        "@xeokit/core/utils(.*)$": path.join(__dirname, "../core/src/utils$1"),
        "@xeokit/core/constants(.*)$": path.join(__dirname, "../core/src/constants$1"),
        "@xeokit/math/math(.*)$": path.join(__dirname, "../math/src/math$1"),
        "@xeokit/math/boundaries(.*)$": path.join(__dirname, "../math/src/boundaries$1"),
        "@xeokit/math/curves(.*)$": path.join(__dirname, "../math/src/curves$1"),
        "@xeokit/math/frustum(.*)$": path.join(__dirname, "../math/src/frustum$1"),
        "@xeokit/math/compression(.*)$": path.join(__dirname, "../math/src/compression$1"),
        "@xeokit/math/matrix(.*)$": path.join(__dirname, "../math/src/matrix$1"),
        "@xeokit/math/ray(.*)$": path.join(__dirname, "../math/src/ray$1"),
        "@xeokit/math/rtc(.*)$": path.join(__dirname, "../math/src/rtc$1"),

        //
        // "@xeokit/math/rtc": ["math/src/rtc"],
        // "@xeokit/viewer": ["viewer/src"],
        // "@xeokit/webglutils": ["webglutils/src"],
        // "@xeokit/webglrenderer": ["webglrenderer/src"],

        "@xeokit/datatypes/basicTypes": path.join(__dirname, "../datatypes/src/basicTypes"),
        "@xeokit/datatypes/ifcTypes(.*)$": path.join(__dirname, "../datatypes/src/ifcTypes"),
        //
        // "@xeokit/xkt": ["xkt/src"],
        // "@xeokit/las": ["las/src"],
        // "@xeokit/gltf": ["gltf/src"],
        // "@xeokit/locale": ["locale/src"],
        // "@xeokit/compression": ["compression/src"],
        // "@xeokit/procgen/geometry": ["procgen/src/geometry"],
        // "@xeokit/ktx2": ["ktx2/src"],
        // "@xeokit/bcf": ["bcf/src"],
        // "@xeokit/controls": ["controls/src"],
        // "@xeokit/scene": ["scene/src"],
//        "@xeokit/treeview": ["treeview/src"]
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    resolver: undefined
};