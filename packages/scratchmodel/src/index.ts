/**
 * <img style="padding:20px" src="media://images/xeokit_scratchmodel_greyscale_icon.png"/>
 *
 * ## Geometry Model Representation
 *
 * * {@link @xeokit/scratchmodel!ScratchModel | ScratchModel}
 * * Buildable, loadable and savable in-memory xeokit model representation
 * * Build models programmatically with builder methods
 * * Load models from files (eg. with {@link loadXKT})
 * * Save models to files (eg. with {@link saveXKT})
 * * Works without {@link @xeokit/viewer!Viewer}
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
 * Creating a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel} with a couple of objects, a geometry and a texture. In this example, we create the geometry
 * from Human-readible uncompressed arrays, which we first pre-compress with {@link @xeokit/compression/compressGeometryParams}.
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 * import {compressGeometryParams} from "@xeokit/math/compression";
 *
 * const myDocModel = new ScratchModel({
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
 * myDocModel.createGeometryCompressed(compressedGeometryParams);
 *
 * myDocModel.createTexture({
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
 * myDocModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * myDocModel.createMesh({
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * myDocModel.createMesh({
 *     id: "myMesh2",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * myDocModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh1"],
 *     //...
 * });
 *
 * myDocModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh2"],
 *     //...
 * });
 *
 * myDocModel.build();
 *
 * const texture = myDocModel.textures["myTexture"];
 * const textureSet = myDocModel.textureSets["myTextureSet"];
 * // ..etc
 *
 * const myGeometry = myDocModel.geometries["myGeometry"];
 * const bucket0 = myGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * // ..etc
 *
 * const myMesh = myDocModel.meshes["myMesh"];
 * // ..etc
 *
 * const myObject1 = myDocModel.objects["myObject1"];
 * const myObject2 = myDocModel.objects["myObject2"];
 * // ..etc
 * ````
 *
 * @module @xeokit/scratchmodel
 */
export * from "./ScratchModel";
