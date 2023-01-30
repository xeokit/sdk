/**
 * #### A buildable and readable model representation.
 *
 * * Buildable - build geometry, materials and objects with builder methods
 * * Readable - read back all the geometry, materials and objects via accessors
 * * Offline - works independently of {@link Viewer} - intended to use as intermediate model representation within nodejs scripts etc.
 *
 * See below for a brief idea of how we use this library in context. See {@link ScratchModel} for full usage.
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/model";
 * import {TrianglesPrimitive} from "@xeokit/core/constants";
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
 * @module @xeokit/model
 */
export * from "./ScratchModel";
