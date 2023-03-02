module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    moduleNameMapper: {
        "@xeokit/core/utils": "<rootDir>/packages/core/src/utils",
        "@xeokit/core/constants": "packages/core/src/constants",
        "@xeokit/core/components": "packages/core/src/components",
        "@xeokit/math/math": "packages/math/src/math",
        "@xeokit/math/boundaries": "packages/math/src/boundaries",
        "@xeokit/math/curves": "packages/math/src/curves",
        "@xeokit/math/frustum": "packages/math/src/frustum",
        "@xeokit/math/geometry": "packages/math/src/geometry",
        "@xeokit/math/matrix": "packages/math/src/matrix",
        "@xeokit/math/ray": "packages/math/src/ray",
        "@xeokit/math/rtc": "packages/math/src/rtc",
        "@xeokit/viewer": "packages/viewer/src",
        "@xeokit/webgl2renderer": "packages/webgl/src",
        "@xeokit/data": "<rootDir>/packages/data/src/",
        "@xeokit/xkt": "packages/xkt/src",
        "@xeokit/las": "packages/las/src",
        "@xeokit/gltf": "packages/gltf/src",
        "@xeokit/locale": "packages/locale/src",
        "@xeokit/math/compression": "packages/compression/src",
        "@xeokit/procgen/geometry": "packages/procgen/src/geometry",
        "@xeokit/ktx2": "packages/ktx2/src",
        "@xeokit/bcf": "packages/bcf/src",
        "@xeokit/cameracontrol": "packages/controls/src",
        "@xeokit/scene": "packages/scene/src"
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    resolver: undefined
};