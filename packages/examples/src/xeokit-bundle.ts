/*---------------------------------------------------------------------------------

 xeokit SDK components for examples

 This ES6 bundle contains most of the client-side Web programming components of the
 xeokit SDK, all bundled up into one big JavaScript library.

 This bundle organizes the contants of each module into its own namespace. This is
 to enhance the clarity of the examples, and to make it easy to trace each
 component back to SDK module where it's implemented.

 ---------------------------------------------------------------------------------*/

// SDK core

export * as core from "@xeokit/core";
export * as constants from "@xeokit/constants";
//
// // Utility libraries
//
export * as math from "@xeokit/math";
export * as matrix from "@xeokit/matrix";
export * as utils from "@xeokit/utils";
export * as rtc from "@xeokit/rtc";
export * as curves from "@xeokit/curves";
export * as boundaries from "@xeokit/boundaries";
export * as compression from "@xeokit/compression";

// Localization

export * as locale from "@xeokit/locale";

// Model definition

//----------------------------------------------------------------------------------
// loaders.gl dependencies commented out of "scene" because they introduced
// nodejs "import" statements into bundle.js
//-------------------------------------------------------------------------------

export * as data from "@xeokit/data";
export * as scene from "@xeokit/scene";

// Collisions, picking

// export * as kdtree2 from "@xeokit/kdtree2";
// export * as kdtree3 from "@xeokit/kdtree3";
// export * as pick from "@xeokit/pick";

// Semantic types

export * as basictypes from "@xeokit/basictypes";
export * as cityjsontypes from "@xeokit/cityjsontypes_1_1_3";
export * as ifctypes from "@xeokit/ifctypes";

// Loaders

// export * as las from "@xeokit/las";
export * as cityjson from "@xeokit/cityjson";
export * as dotbim from "@xeokit/dotbim";
// export * as threedxml from "@xeokit/threedxml";


//----------------------------------------------------------------------------------
// Next "gltf" export commented out because it introduces error:
// 'requireFromFile' is not exported by 'node-resolve:empty.js' etc
//-------------------------------------------------------------------------------

//export * as gltf from "@xeokit/gltf";
// export * as webifc from "@xeokit/webifc";
// export * as xkt from "@xeokit/xkt";

// Viewer

export * as viewer from "@xeokit/viewer";
export * as mockrenderer from "@xeokit/mockrenderer";
//export * as webglrenderer from "@xeokit/webglrenderer";
export * as ktx2 from "@xeokit/ktx2";
export * as cameracontrol from "@xeokit/cameracontrol";
export * as bcf from "@xeokit/bcf";
export * as treeview from "@xeokit/treeview";
