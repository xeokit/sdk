/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2FscratchModel.svg)](https://badge.fury.io/js/%40xeokit%2FscratchModel)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/scratchModel/badge)](https://www.jsdelivr.com/package/npm/@xeokit/scratchModel)
 *
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
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 *
 * const sceneModel = new ScratchModel({ // ScratchModel implements SceneModel
 *     id: "myTable"
 * });
 *
 * sceneModel.createGeometryCompressed({
 *     id: "myBoxGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positionsDecompressMatrix: [0.00003052270125906143, 0, 0, 0, 0, 0.00003052270125906143, 0, 0, 0, 0, 0.00003052270125906143, 0, -1, -1, -1, 1],
 *     geometryBuckets: [{
 *       indices: [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2, 4, 7, 6, 4, 6, 5],
 *       positionsCompressed: [65525, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0, 65525, 65525, 0, 0, 65525, 65525, 0, 0, 65525, 0, 0, 0, 0]
 *     }]
 * });
 *
 * sceneModel.createTexture({
 *      id: "myColorTexture",
 *      src: "myTexture.ktx2",
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
 *     id: "redLegMesh",
 *     geometryId: "myBoxGeometry",
 *     position: [-4, -6, -4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [1, 0.3, 0.3],
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({ // Red table leg object
 *     id: "redLeg",
 *     meshIds: ["redLegMesh"]
 * });
 *
 * sceneModel.createMesh({
 *     id: "greenLegMesh",
 *     geometryId: "myBoxGeometry",
 *     position: [4, -6, -4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [0.3, 1.0, 0.3],
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({ // Green table leg object
 *     id: "greenLeg",
 *     meshIds: ["greenLegMesh"]
 * });
 *
 * sceneModel.createMesh({
 *     id: "blueLegMesh",
 *     geometryId: "myBoxGeometry",
 *     position: [4, -6, 4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [0.3, 0.3, 1.0],
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({ // Blue table leg object
 *     id: "blueLeg",
 *     meshIds: ["blueLegMesh"]
 * });
 *
 * sceneModel.createMesh({
 *     id: "yellowLegMesh",
 *     geometryId: "myBoxGeometry",
 *     position: [-4, -6, 4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [1.0, 1.0, 0.0],
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({ // Yellow table leg object
 *     id: "yellowLeg",
 *     meshIds: ["yellowLegMesh"]
 * });
 *
 * sceneModel.createMesh({
 *     id: "tableTopMesh",
 *     geometryId: "myBoxGeometry",
 *     position: [0, -3, 0],
 *     scale: [6, 0.5, 6],
 *     rotation: [0, 0, 0],
 *     color: [1.0, 0.3, 1.0],
 *     textureSetId: "myTextureSet"
 * });
 *
 * sceneModel.createObject({ // Purple table top object
 *     id: "tableTop",
 *     meshIds: ["tableTopMesh"]
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
