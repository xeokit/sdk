const path = require('path');

module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    moduleNameMapper: {
        "@xeokit/basictypes/(.*)$": path.join(__dirname, "./packages/basictypes/src/$1"),
        "@xeokit/bcf/(.*)$": path.join(__dirname, "./packages/bcf/src/$1"),
        "@xeokit/boundaries/(.*)$": path.join(__dirname, "./packages/boundaries/src/$1"),
        "@xeokit/bundle/(.*)$": path.join(__dirname, "./packages/bundle/src/$1"),
        "@xeokit/cameracontrol/(.*)$": path.join(__dirname, "./packages/cameracontrol/src/$1"),
        "@xeokit/cityjson/(.*)$": path.join(__dirname, "./packages/cityjson/src/$1"),
        "@xeokit/cityjson2dtx/(.*)$": path.join(__dirname, "./packages/cityjson2dtx/src/$1"),
        "@xeokit/cityjsontypes_1_1_3/(.*)$": path.join(__dirname, "./packages/cityjsontypes_1_1_3/src/$1"),
        "@xeokit/compression(.*)$": path.join(__dirname, "./packages/compression/src/$1"),
        "@xeokit/constants(.*)$": path.join(__dirname, "./packages/constants/src/$1"),
        "@xeokit/core(.*)$": path.join(__dirname, "./packages/core/src/$1"),
        "@xeokit/curves(.*)$": path.join(__dirname, "./packages/curves/src/$1"),
        "@xeokit/data/(.*)$": path.join(__dirname, "./packages/data/src/$1"),
        "@xeokit/dotbim/(.*)$": path.join(__dirname, "./packages/data/src/$1"),
        "@xeokit/gltf/(.*)$": path.join(__dirname, "./packages/gltf/src/$1"),
        "@xeokit/gltf2dtx/(.*)$": path.join(__dirname, "./packages/gltf2dtx/src/$1"),
        "@xeokit/ifc2dtx/(.*)$": path.join(__dirname, "./packages/ifc2dtx/src/$1"),
        "@xeokit/kdtree2/(.*)$": path.join(__dirname, "./packages/kdtree2/src/$1"),
        "@xeokit/kdtree3/(.*)$": path.join(__dirname, "./packages/kdtree3/src/$1"),
        "@xeokit/ktx2/(.*)$": path.join(__dirname, "./packages/ktx2/src/$1"),
        "@xeokit/las/(.*)$": path.join(__dirname, "./packages/las/src/$1"),
        "@xeokit/las2dtx/(.*)$": path.join(__dirname, "./packages/las2dtx/src/$1"),
        "@xeokit/locale/(.*)$": path.join(__dirname, "./packages/locale/src/$1"),
        "@xeokit/math(.*)$": path.join(__dirname, "./packages/math/src/$1"),
        "@xeokit/matrix(.*)$": path.join(__dirname, "./packages/matrix/src/$1"),
        "@xeokit/pick(.*)$": path.join(__dirname, "./packages/pick/src/$1"),
        "@xeokit/procgen(.*)$": path.join(__dirname, "./packages/procgen/src/$1"),
        "@xeokit/rtc(.*)$": path.join(__dirname, "./packages/rtc/src/$1"),
        "@xeokit/scene(.*)$": path.join(__dirname, "./packages/scene/src/$1"),
        "@xeokit/threedxml(.*)$": path.join(__dirname, "./packages/threedxml/src/$1"),
        "@xeokit/treeview(.*)$": path.join(__dirname, "./packages/treeview/src/$1"),
        "@xeokit/utils(.*)$": path.join(__dirname, "./packages/utils/src/$1"),
        "@xeokit/viewer(.*)$": path.join(__dirname, "./packages/viewer/src/$1"),
        "@xeokit/webglrenderer(.*)$": path.join(__dirname, "./packages/webglrenderer/src/$1"),
        "@xeokit/webglutils(.*)$": path.join(__dirname, "./packages/webglutils/src/$1"),
        "@xeokit/webgpu(.*)$": path.join(__dirname, "./packages/webgpu/src/$1"),
        "@xeokit/webgpurenderer(.*)$": path.join(__dirname, "./packages/webgpurenderer/src/$1"),
        "@xeokit/webifc(.*)$": path.join(__dirname, "./packages/webifc/src/$1"),
        "@xeokit/ifcviewer(.*)$": path.join(__dirname, "./packages/ifcviewer/src/$1")
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    resolver: undefined,
    silent: false,
    "reporters": [
        "default",
        ["./../../node_modules/jest-html-reporter", {
            "pageTitle": "Test Report"
        }]
    ]
};