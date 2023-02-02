/**
 * <img src="https://camo.githubusercontent.com/0465b8f81dacf8cba3d4b110bcfd46f3cb98d419219b4c595a3ca2a81172af3c/687474703a2f2f78656f6b69742e696f2f696d672f646f63732f506572666f726d616e63654d6f64656c2f506572666f726d616e63654d6f64656c2e706e67"/>
 *
 * ## Model Document Representation
 *
 * * {@link ScratchModel}
 * * Offline buildable, loadable and savable model document representation
 * * Build models programmatically with builder methods
 * * Load models from files (see {@link loadXKT} etc.)
 * * Save models to files (see {@link saveXKT})
 * * Works without {@link Viewer}
 * * Use "offline" in Node scripts to generate and convert models.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/scratchmodel
 * ````
 *
 * ## Usage
 *
 * Creating a {@link ScratchModel} with a couple of objects, a geometry and a texture. In this example, we create the geometry
 * from Human-readible uncompressed arrays, which we first pre-compress with {@link compressGeometryParams}.
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
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * myScratchModel.createMesh({
 *     id: "myMesh2",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * myScratchModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh1"],
 *     //...
 * });
 *
 * myScratchModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh2"],
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
