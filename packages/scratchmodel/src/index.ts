/**
 * ## Viewer-Agnostic Model Representation
 *
 * * {@link ScratchModel}
 * * Build models programmatically with builder methods
 * * Load models from files (eg. {@link loadXKT})
 * * Save models to files (eg. {@link saveXKT})
 * * Works independently of {@link Viewer} - use in NodeJs etc
 *
 * ## Use Cases
 *
 * * Intermediate model representation within offline file conversion tools
 * * Buildable model representation within procedural model generation scripts
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/scratchmodel
 * ````
 *
 * ## Usage
 *
 * See {@link ScratchModel} for full usage.
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 * import {compressGeometryParams} from "@xeokit/math/compression";
 *
 * const myScratchModel = new ScratchModel({
 *     id: "myModel"
 * });
 *
 * const compressedGeometryParams = compressGeometryParams({
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [202, 202, 202, 200, 202, 202, ...],
 *      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ...]
 * });
 *
 * myScratchModel.createGeometryCompressed(compressedGeometryParams);
 *
 * myScratchModel.createTexture({
 *      id: "myColorTexture",
 *      src: // Path to JPEG, PNG, KTX2,
 *      image: // HTMLImageElement,
 *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
 *      preloadColor: [1,0,0,1],
 *      flipY: false,
 *      encoding: LinearEncoding, // @xeokit/core/constants
 *      magFilter: LinearFilter,
 *      minFilter: LinearFilter,
 *      wrapR: ClampToEdgeWrapping,
 *      wrapS: ClampToEdgeWrapping,
 *      wrapT: ClampToEdgeWrapping,
 * });
 *
 * myScratchModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * myScratchModel.createMesh({
 *     id: "myMesh",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * myScratchModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh"],
 *     //...
 * });
 *
 * myScratchModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh"],
 *     //...
 * });
 *
 * myScratchModel.build();
 *
 * const texture = myScratchModel.textures["myTexture"];
 * const textureSet = myScratchModel.textureSets["myTextureSet"];
 * // ..etc
 *
 * const myGeometry = myScratchModel.geometries["myGeometry"];
 * const bucket0 = myGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * // ..etc
 *
 * const myMesh = myScratchModel.meshes["myMesh"];
 * // ..etc
 *
 * const myObject1 = myScratchModel.objects["myObject1"];
 * const myObject2 = myScratchModel.objects["myObject2"];
 * // ..etc
 * ````
 *
 * @module @xeokit/scratchmodel
 */
export * from "./ScratchModel";
