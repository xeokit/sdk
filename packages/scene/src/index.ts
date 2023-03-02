/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2FscratchModel.svg)](https://badge.fury.io/js/%40xeokit%2FscratchModel)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/scratchModel/badge)](https://www.jsdelivr.com/package/npm/@xeokit/scratchModel)
 *
 * <img style="padding:20px" src="media://images/xeokit_docmodel_greyscale_icon.png"/>
 *
 * ## Geometry Model Representation
 *
 * * {@link @xeokit/scene!SceneModel | SceneModel} is a {@link @xeokit/scene!SceneModel} implementation that works headless, without a {@link @xeokit/viewer!Viewer}
 * * Buildable, loadable and savable in-memory xeokit model representation
 * * Build models programmatically with builder methods
 * * Load models from files (eg. {@link @xeokit/xkt!loadXKT | loadXKT}, {@link @xeokit/gltf!loadGLTF | loadGLTF}, {@link @xeokit/las!loadLAS | loadLAS}...)
 * * Save models to files (eg. {@link @xeokit/xkt!saveXKT | saveXKT})
 * * Use "offline" in Node scripts to generate and convert models.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/scene
 * ````
 *
 * ## Usage
 *
 * In the example below, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} with a couple of
 * objects, a geometry and a texture.
 *
 * We'll create the geometry from Human-readable uncompressed arrays, which we'll pre-compress
 * with {@link @xeokit/scene!compressGeometryParams | compressGeometryParams}.
 *
 * When we've finished constructing our SceneModel, we'll call {@link SceneModel.build | SceneModel.build},
 * and then we'll use {@link @xeokit/xkt!saveXKT | saveXKT} to save it as an XKT file in an ArrayBuffer.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 * import {saveXKT} from "@xeokit/xkt";
 *
 * const scene = new Scene({});
 *
 * const sceneModel = scene.createSceneModel({
 *     id: "myTable"
 * });
 *
 * sceneModel.createGeometry({
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [ // Floats
 *          1, 1, 1, -1, 1, 1,
 *          -1, -1, 1, 1, -1, 1, 1,
 *          -1, -1, 1, 1, -1, -1, 1, -1, -1,
 *          -1, -1
 *      ],
 *      indices: [
 *          0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
 *          6, 7, 8, 9, 10, 8, 10, 11, 12,
 *          13, 14, 12, 14, 15, 16, 17, 18,
 *          16, 18, 19, 20, 21, 22, 20, 22, 23
 *      ]
 *  });
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
 * ## Geometry Compression
 *
 * This library provides function {@link compressGeometryParams}, which is used internally by
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} to
 * compress geometry. The function is provided in case users instead want to pre-compress their geometry
 * and then use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create the compressed geometry directly.
 *
 * ### Compression Techniques Used
 *
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Converts positions to relative-to-center (RTC) coordinates
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Splits geometry into {@link @xeokit/scene!GeometryBucketParams | buckets } to enable indices to use the minimum bits for storage
 *
 * ### Aknowledgements
 *
 * * The bucketing technique mentioned above was developed for xeokit by Toni Marti, with support from Tribia AG. Read [the slides](media://pdfs/GPU_RAM_Savings_Toni_Marti_Apr22.pdf) from Toni's presentation at WebGL Meetup 2022.
 *
 * In the example below, we'll use {@link compressGeometryParams} to compress
 * a {@link @xeokit/scene!GeometryParams | GeometryParams} into a
 * {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}.
 *
 * In this example, our geometry is very simple, and our GeometryCompressedParams only gets a single
 * {@link @xeokit/scene!GeometryBucketParams | GeometryBucketParams }. Note that if the
 * {@link @xeokit/scene!GeometryParams.positions | GeometryParams.positions} array was large enough to require
 * some indices to use more than 16 bits for storage, then that's when the function's bucketing mechanism would
 * kick in, to split the geometry into smaller buckets, each with smaller indices that index a subset of the positions.
 *
 * ````javascript
 * import {compressGeometryParams} from "@xeokit/math/compression";
 * import {TrianglesPrimitive} from "@xeokit/core/constants";
 *
 * const geometryCompressedParams = compressGeometryParams({
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      positions: [ // Floats
 *          1, 1, 1, -1, 1, 1,
 *          -1, -1, 1, 1, -1, 1, 1,
 *          -1, -1, 1, 1, -1, -1, 1, -1, -1,
 *          -1, -1
 *      ],
 *      indices: [
 *          0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
 *          6, 7, 8, 9, 10, 8, 10, 11, 12,
 *          13, 14, 12, 14, 15, 16, 17, 18,
 *          16, 18, 19, 20, 21, 22, 20, 22, 23
 *      ]
 *  });
 * ````
 *
 * The value of our new {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams} is shown below.
 *
 * We can see that:
 *
 * * We get one bucket, because we have only a small number of indices
 * * Vertex positions are now relative to ````origin```` and quantized to 16-bit integers
 * * Duplicate positions are removed and indices adjusted
 * * Edge indices generated for our TrianglesPrimitive
 * * A ````positionsDecompressMatrix```` to de-quantize the positions within the Viewer
 *
 * ````javascript
 * {
 *      id: "myBoxGeometry",
 *      primitive: TrianglesPrimitive,
 *      origin: [200,200,200],
 *      positionsDecompressMatrix: [
 *          0.00003052270125906143, 0, 0, 0,
 *          0, 0.00003052270125906143, 0, 0,
 *          0, 0, 0.00003052270125906143, 0,
 *          -1, -1, -1, 1
 *      ],
 *      geometryBuckets: [
 *          {
 *              positionsCompressed: [
 *                  65525, 65525, 65525, 0, 65525, 65525,
 *                  0, 0, 65525, 65525, 0, 65525, 65525,
 *                  0, 0, 65525, 65525, 0, 0, 65525, 0, 0,
 *                  0, 0
 *              ],
 *              indices: [
 *                  0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
 *                  0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
 *                  4, 7, 6, 4, 6, 5
 *              ],
 *              edgeIndices: [
 *                  3, 4, 0, 4, 5, 0, 5, 6,
 *                  0, 6, 1, 1, 6, 7, 1, 7,
 *                  3, 2, 4, 7, 6, 4, 6
 *              ]
 *          }
 *      ]
 * }
 * ````
 *
 * TODO TODO
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 * 
 * const scene = new Scene({});
 *
 * const sceneModel = scene.createSceneModel({
 *     id: "myTable"
 * });
 *
 * sceneModel.createGeometryCompressed(geometryCompressedParams);
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
 * ````
 *
 * @module @xeokit/scene
 */

export * from "./Geometry";
export * from "./GeometryBucket";
export * from "./Mesh";

export * from "./RendererGeometry";
export * from "./RendererMesh";
export * from "./RendererObject";
export * from "./RendererModel";
export * from "./RendererTexture";
export * from "./RendererTextureSet";

export * from "./Scene";
export * from "./SceneModel";
export * from "./SceneObject";
export * from "./Texture";

export * from "./MeshParams";
export * from "./ObjectParams";
export * from "./TextureParams";
export * from "./TextureSetParams";
export * from "./TransformParams";

export * from "./GeometryBucketParams";
export * from "./GeometryCompressedParams";
export * from "./GeometryParams";

export * from "./AddModelParams";

export * from "./compressGeometryParams";