/**
 * <img style="padding:20px" src="media://images/xeokit_docmodel_greyscale_icon.png"/>
 *
 * ## Geometry Model Representation
 *
 * * {@link @xeokit/scratchmodel!ScratchModel | ScratchModel} is a {@link @xeokit/core/components!SceneModel} implementation that works headless, without a {@link @xeokit/viewer!Viewer}
 * * Buildable, loadable and savable in-memory xeokit model representation
 * * Build models programmatically with builder methods
 * * Load models from files (eg. {@link @xeokit/xkt!loadXKT | loadXKT}, {@link @xeokit/gltf!loadGLTF | loadGLTF}, {@link @xeokit/las!loadLAS | loadLAS}...)
 * * Save models to files (eg. {@link @xeokit/xkt!saveXKT | saveXKT})
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
 * In the example below, we'll create a {@link @xeokit/scratchmodel!ScratchModel | ScratchModel} with a couple of
 * objects, a geometry and a texture.
 *
 * We'll create the geometry from Human-readable uncompressed arrays, which we'll pre-compress
 * with {@link @xeokit/compression!compressGeometryParams | compressGeometryParams}.
 *
 * When we've finished constructing our ScratchModel, we'll call {@link ScratchModel.build | ScratchModel.build},
 * and then we'll use {@link @xeokit/xkt!saveXKT | saveXKT} to save it as an XKT file in an ArrayBuffer.
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/scratchmodel";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 * import {compressGeometryParams} from "@xeokit/math/compression";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const sceneModel = new ScratchModel({     // ScratchModel is a SceneModel
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
 * sceneModel.createGeometryCompressed(compressedGeometryParams);
 *
 * sceneModel.createTexture({
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
 * sceneModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture"
 * });
 *
 * sceneModel.createMesh({
 *     id: "myMesh1",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * sceneModel.createMesh({
 *     id: "myMesh2",
 *     geometryId: "myGeometry",
 *     textureSetId: "myTextureSet",
 *     //...
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh1"],
 *     //...
 * });
 *
 * sceneModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh2"],
 *     //...
 * });
 *
 * sceneModel.build();
 *
 * const texture = sceneModel.textures["myTexture"];
 * const textureSet = sceneModel.textureSets["myTextureSet"];
 * // ..etc
 *
 * const myGeometry = sceneModel.geometries["myGeometry"];
 * const bucket0 = myGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * // ..etc
 *
 * const myMesh = sceneModel.meshes["myMesh"];
 * // ..etc
 *
 * const myObject1 = sceneModel.objects["myObject1"];
 * const myObject2 = sceneModel.objects["myObject2"];
 * // ..etc
 *
 * const arrayBuffer = saveXKT({
 *      sceneModel
 * });
 * ````
 *
 * @module @xeokit/scratchmodel
 */
export * from "./ScratchModel";
