/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2FscratchModel.svg)](https://badge.fury.io/js/%40xeokit%2FscratchModel)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/scratchModel/badge)](https://www.jsdelivr.com/package/npm/@xeokit/scratchModel)
 *
 * <img style="padding:20px" src="media://images/xeokit_docmodel_greyscale_icon.png"/>
 *
 * ## xeokit Geometry and Materials Model
 *
 * * {@link @xeokit/scene!Scene} is a container for {@link @xeokit/scene!SceneModel | SceneModels},
 * which contain {@link SceneObject | SceneObjects}, {@link Mesh | Meshes}, {@link Geometry | Geometries} and {@link Texture | Textures}.
 * * Texture compressed using [Basis](/docs/pages/GLOSSARY.html#basis)
 * * Geometry compressed using [bucketing](/docs/pages/GLOSSARY.html#geometry-bucketing) and [quantization](/docs/pages/GLOSSARY.html#geometry-quantization)
 * * View SceneModels in the Browser using a {@link "@xeokit/viewer" | Viewer}
 * * Import SceneModels from various model file formats using importer functions such as
 * {@link "@xeokit/gltf" | loadGLTF}, {@link "@xeokit/las" | loadLAS},
 * {@link "@xeokit/cityjson" | loadCityJSON}, {@link "@xeokit/xkt" | loadXKT} etc.
 * * Export SceneModels to native XKT format using {@link "@xeokit/xkt" | saveXKT}
 * * Programmatically build SceneModels using builder methods {@link @xeokit/scene!Scene.createModel | Scene.createModel},
 * {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject},
 * {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh},
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry} and
 * {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/scene
 * ````
 *
 * ## Usage
 *
 * * [Creating a SceneModel](#creating-a-scenemodel)
 * * [Reading the SceneModel](#reading-the-scenemodel)
 * * [Geometry Compression](#geometry-compression)
 * * [Texture Compression](#texture-compression)
 *
 * ### Creating a SceneModel
 *
 * In the example below, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} that will model the simple table furniture model
 * shown in the image above. Our SceneModel will get five
 * {@link @xeokit/scene!SceneObject | SceneObjects}, five {@link @xeokit/scene!Mesh | Meshes},
 * a {@link @xeokit/scene!Geometry | Geometry} and a {@link @xeokit/scene!Texture | Texture}.
 *
 * When we've finished constructing our SceneModel, we'll call {@link SceneModel.build | SceneModel.build}, which
 * (asynchronously) compresses our Texture.
 *
 * At that point, we can use the SceneModel. For example, we could export it to xeokit's native XKT
 * file format using {@link "@xeokit/xkt" | saveXKT}, or view it in the Browser using a {@link "@xeokit/viewer" | Viewer}.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/core/constants";
 *
 * // Scene is the container of SceneModels
 *
 * const theScene = new Scene();
 *
 * const sceneModel = theScene.createModel({
 *   id: "theModel"
 * });
 *
 * const geometry = sceneModel.createGeometry({
 *      id: "boxGeometry",
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
 * const texture = sceneModel.createTexture({
 *     id: "colorTexture",
 *     src: "./assets/sample_etc1s.ktx2",
 *     preloadColor: [1, 0, 0, 1],
 *     flipY: false,
 *     encoding: LinearEncoding,
 *     magFilter: LinearFilter,
 *     minFilter: LinearFilter,
 *     wrapR: ClampToEdgeWrapping,
 *     wrapS: ClampToEdgeWrapping,
 *     wrapT: ClampToEdgeWrapping,
 * });
 *
 * const theTextureSet = sceneModel.createTextureSet({
 *     id: "theTextureSet",
 *     colorTextureId: "colorTexture"
 * });
 *
 * const redLegMesh = sceneModel.createMesh({
 *     id: "redLegMesh",
 *     geometryId: "boxGeometry",
 *     position: [-4, -6, -4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [1, 0.3, 0.3],
 *     textureSetId: "theTextureSet"
 * });
 *
 * const greenLegMesh = sceneModel.createMesh({
 *     id: "greenLegMesh",
 *     geometryId: "boxGeometry",
 *     position: [4, -6, -4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [0.3, 1.0, 0.3],
 *             textureSetId: "theTextureSet"
 * });
 *
 * const blueLegMesh = sceneModel.createMesh({
 *     id: "blueLegMesh",
 *     geometryId: "boxGeometry",
 *     position: [4, -6, 4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [0.3, 0.3, 1.0],
 *     textureSetId: "theTextureSet"
 * });
 *
 * const yellowLegMesh = sceneModel.createMesh({
 *     id: "yellowLegMesh",
 *     geometryId: "boxGeometry",
 *     position: [-4, -6, 4],
 *     scale: [1, 3, 1],
 *     rotation: [0, 0, 0],
 *     color: [1.0, 1.0, 0.0],
 *     textureSetId: "theTextureSet"
 * });
 *
 *  const tableTopMesh = sceneModel.createMesh({
 *     id: "tableTopMesh",
 *     geometryId: "boxGeometry",
 *     position: [0, -3, 0],
 *     scale: [6, 0.5, 6],
 *     rotation: [0, 0, 0],
 *     color: [1.0, 0.3, 1.0],
 *     textureSetId: "theTextureSet"
 * });
 *
 * // Create five SceneObjects, each using a Mesh.
 * // A Mesh belongs to exactly one SceneObject.
 *
 * const redLegSceneObject = sceneModel.createObject({
 *     id: "redLegObject",
 *     meshIds: ["redLegMesh"]
 * });
 *
 * const greenLegSceneObject = sceneModel.createObject({
 *     id: "greenLegObject",
 *     meshIds: ["greenLegMesh"]
 * });
 *
 * const blueLegSceneObject = sceneModel.createObject({
 *     id: "blueLegObject",
 *     meshIds: ["blueLegMesh"]
 * });
 *
 * const yellowLegSceneObject = sceneModel.createObject({
 *     id: "yellowLegObject",
 *     meshIds: ["yellowLegMesh"]
 * });
 *
 * const tableTopSceneObject = sceneModel.createObject({
 *     id: "tableTopObject",
 *     meshIds: ["tableTopMesh"]
 * });
 *
 * // Expect an event when we build the SceneModel
 *
 * sceneModel.onBuilt.subscribe((theSceneModel)=>{ });
 *
 * // Expect an event when we destroy the SceneModel
 *
 * sceneModel.onDestroyed.subscribe((theSceneModel)=>{ });
 *
 * // Now build the SceneModel.
 * // This makes the SceneModel ready for use.
 * // Among other things, this will compress the texture.
 *
 * sceneModel.build().then(()=> {
 *
 *     // SceneModel is ready for use
 * })
 * ````
 *
 * ### Reading the SceneModel
 *
 * Now that we've built our SceneModel, we can read all of its components. Note that the {@link Texture} and {@link Geometry}
 * we just created will now be compressed.
 *
 * ````javascript
 * const theSceneModel = theScene.models["theModel"];
 * const theTexture = theSceneModel.textures["theColorTexture"];
 * const theTextureSet = theSceneModel.textureSets["theTextureSet"];
 * const boxGeometry = theSceneModel.geometries["boxGeometry"];
 * const theTableTopMesh = theSceneModel.meshes["tableTopMesh"];
 * const theTableTopObject = theSceneModel.objects["tableTopObject"];
 * const theTableTopObjectAgain = theScene.objects["tableTopObject"];
 * ````
 *
 * ### Geometry Compression
 *
 * The geometry from our query example requires a closer look. Internally, the {@link SceneModel.createGeometry}
 * method uses the {@link compressGeometryParams} function to compress the geometry and generate edge indices for 
 * rendering it as a wireframe.
 *
 * We provide that function as part of the API in case users want to pre-compress the geometry themselves
 * and then use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create the compressed geometry directly.
 *
 * The {@link compressGeometryParams} function performs these steps to compress the geometry:
 *
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Converts positions to relative-to-center (RTC) coordinates
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Splits geometry into {@link @xeokit/scene!GeometryBucketParams | buckets } to enable indices to use the minimum bits for storage
 *
 * Our compressed geometry then looks like this:
 *
 * ````javascript
 * const bucket0 = boxGeometry.buckets[0];
 * const bucket0Positions = bucket0.positions;
 * const bucketindices = bucket0.indices;
 * const bucketEdgeIndices = bucket0.edgeIndices;
 * // ...
 * ````
 *
 * The bucketing technique was developed for xeokit by Toni Marti, with support from Tribia AG. Read [the slides](media://pdfs/GPU_RAM_Savings_Toni_Marti_Apr22.pdf) from Toni's presentation at WebGL Meetup 2022.
 *
 * In the example below, we'll now use {@link compressGeometryParams} to compress
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
 *      id: "boxGeometry",
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
 *      id: "boxGeometry",
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
 * ### Texture Compression
 *
 * The {@link Texture} from our query example also requires a closer look. Internally, the {@link SceneModel.build}
 * method uses [Basis](/docs/pages/GLOSSARY.html#basis) to compress the Texture to KTX2. We can now read that transcoded data
 * back from {@link @Texture.buffers | Texture.buffers}:
 *
 * ````javascript
 * const theTexture = theSceneModel.textures["theColorTexture"];
 *
 * const buffers = thetexture.buffers; // ArrayBuffer[]
 * ````
 *
 * @module @xeokit/scene
 */

export * from "./Scene";
export * from "./SceneModel";
export * from "./SceneObject";
export * from "./Texture";
export * from "./TextureSet";
export * from "./Geometry";
export * from "./GeometryBucket";
export * from "./Mesh";

export * from "./RendererGeometry";
export * from "./RendererMesh";
export * from "./RendererObject";
export * from "./RendererModel";
export * from "./RendererTexture";
export * from "./RendererTextureSet";

export * from "./MeshParams";
export * from "./SceneObjectParams";
export * from "./TextureParams";
export * from "./TextureSetParams";
export * from "./TransformParams";
export * from "./GeometryBucketParams";
export * from "./GeometryCompressedParams";
export * from "./GeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";