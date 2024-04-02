/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2FscratchModel.svg)](https://badge.fury.io/js/%40xeokit%2FscratchModel)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/scratchModel/badge)](https://www.jsdelivr.com/package/npm/@xeokit/scratchModel)
 *
 * <img style="padding:20px" src="media://images/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit Scene Representation
 *
 * ---
 *
 * ### *The SDK's buildable, viewable, importable and exportable 3D scene representation*
 *
 * ---
 *
 * The xeokit SDK facilitates the management of model representations through a scene graph that incorporates the
 * model's objects, geometries, and materials. This scene graph functions seamlessly in both the browser and NodeJS
 * environments, enabling the generation of models, format conversion, and the provision of content for the SDK's
 * model viewer.
 *
 * To elaborate further:
 *
 * * The {@link @xeokit/scene!Scene} acts as a container for {@link @xeokit/scene!SceneModel | SceneModels}, which, in turn,
 * comprise {@link @xeokit/scene!SceneObject | SceneObjects}, {@link @xeokit/scene!SceneMesh | Meshes}, {@link @xeokit/scene!SceneGeometry | Geometries}, {@link @xeokit/scene!SceneGeometryBucket | GeometryBuckets}, and {@link @xeokit/scene!SceneTexture | Textures}.
 * * Textures undergo compression to [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) via the Basis Universal codec.
 * * SceneGeometry undergoes compression through bucketing and quantization.
 * * Use a {@link "@xeokit/viewer" | Viewer} to view SceneModels in the browser. A Viewer equipped with a {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder} can view a Scene that has KTX2-compressed textures.
 * * Import SceneModels from a variety of model file formats using importer functions like {@link "@xeokit/gltf" | loadGLTF}, {@link "@xeokit/las" | loadLAS}, {@link "@xeokit/cityjson" | loadCityJSON}, and {@link "@xeokit/dtx" | loadDTX}.
 * * Export SceneModels to the native [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) format through {@link "@xeokit/dtx" | saveDTX}.
 * * Create SceneModels programmatically using builder methods like {@link @xeokit/scene!Scene.createModel | Scene.createModel},
 * {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject}, {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh},
 * {@link @xeokit/scene!SceneModel.createGeometry | SceneModel.createGeometry}, and {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}. Add geometry
 * primitives using mesh generator functions like {@link @xeokit/procgen!buildBoxGeometry | buildBoxGeometry}, {@link @xeokit/procgen!buildSphereGeometry | buildSphereGeometry}, {@link @xeokit/procgen!buildTorusGeometry | buildTorusGeometry}, {@link @xeokit/procgen!buildCylinderGeometry | buildCylinderGeometry}, {@link @xeokit/procgen!buildPlaneGeometry | buildPlaneGeometry} and {@link @xeokit/procgen!buildVectorTextGeometry | buildVectorTextGeometry}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNVU2PmzAQ_SvIp3aVjTaJk0AOPbQr7aVRpc2qlSoujplN3AJGttkmjfLfawwkNph0uQBvnufNh8c-IcoTQCtEUyLlIyM7QbI4T5gAqhjPg6_PcR6YxzCCDYUcTi1mcAFEwVq7ST98dAwpEOFCWcWSNsK3v7TSBTp71IxrS5Il1-_O8koC5B5sYAc8AyWYAyo4qFLABpQHtaA6uW9GxU6lSVpr9dGnWvDYt7zU_gcNOhzbti1ZmthAAlIJbjn2lasO1mmRXTFPhQJCttsBl1WKwUDxKU-5uP4KXu72OUjLta4DSV2IF4QydbQ4RDfncP1v-mUxrs0aCLIpnz9OP1c7u5lWQ-ukkjL63GbZY3BK01LqoelZIGNSsjfoGDqRtftmKK5CsIwp7caCuGTVmMpHoDwr9NaV6045y7cbxrbWn0v6Gwan8Mlh2eFd9L80ApA4yj6Y6dOFwv-0vjP44yi1yb8cC18BfnCR3hRxZXagrGHpV_4SVfs27CBGkxjd3d_r93h8FyPrgHKIBhlg15Lv8eth1lCfX41pS7xk02O5jWz5ZsQtrkVsKdbQOE6x5nY2tcfbizW_10YMtKBd-qle6ynE-xbaG6ldiUYoA5ERlugbz_Q6RmoPGcRopT8TeCVlqmIU52dNJaXim2NO0eqVpBJGqCwSfVY3l-QFhYQpLtbNNVq9RqggOVqd0AGtpouH8WSyxOFiOo9meDnDI3TU8GyMo-UixBGehOEyCqfnEfrLuXb7MA6nC4wX0wgvQzzH88j4-2mMSpRw_geACkF7?type=png)](https://mermaid.live/edit#pako:eNqNVU2PmzAQ_SvIp3aVjTaJk0AOPbQr7aVRpc2qlSoujplN3AJGttkmjfLfawwkNph0uQBvnufNh8c-IcoTQCtEUyLlIyM7QbI4T5gAqhjPg6_PcR6YxzCCDYUcTi1mcAFEwVq7ST98dAwpEOFCWcWSNsK3v7TSBTp71IxrS5Il1-_O8koC5B5sYAc8AyWYAyo4qFLABpQHtaA6uW9GxU6lSVpr9dGnWvDYt7zU_gcNOhzbti1ZmthAAlIJbjn2lasO1mmRXTFPhQJCttsBl1WKwUDxKU-5uP4KXu72OUjLta4DSV2IF4QydbQ4RDfncP1v-mUxrs0aCLIpnz9OP1c7u5lWQ-ukkjL63GbZY3BK01LqoelZIGNSsjfoGDqRtftmKK5CsIwp7caCuGTVmMpHoDwr9NaV6045y7cbxrbWn0v6Gwan8Mlh2eFd9L80ApA4yj6Y6dOFwv-0vjP44yi1yb8cC18BfnCR3hRxZXagrGHpV_4SVfs27CBGkxjd3d_r93h8FyPrgHKIBhlg15Lv8eth1lCfX41pS7xk02O5jWz5ZsQtrkVsKdbQOE6x5nY2tcfbizW_10YMtKBd-qle6ynE-xbaG6ldiUYoA5ERlugbz_Q6RmoPGcRopT8TeCVlqmIU52dNJaXim2NO0eqVpBJGqCwSfVY3l-QFhYQpLtbNNVq9RqggOVqd0AGtpouH8WSyxOFiOo9meDnDI3TU8GyMo-UixBGehOEyCqfnEfrLuXb7MA6nC4wX0wgvQzzH88j4-2mMSpRw_geACkF7)
 *
 * <br>
 *
 * ### Notes
 *
 * * TextureSets are collections of textures that are shared among Meshes and are organized into texture atlasses to optimize rendering efficiency on GPUs.
 * * Geometries are arranged automatically into {@link @xeokit/scene!SceneGeometryBucket | GeometryBuckets} to reduce memory consumption. These buckets utilize geometry quantization and geometry bucketing techniques to minimize storage bit usage.
 * * Each SceneMesh can be assigned to only one SceneObject, whereas each SceneGeometry and SceneTextureSet can be allocated to an unlimited number of Meshes.
 * * The {@link getSceneObjectGeometry} function can be used to conveniently iterate the World-space geometry within each
 * {@link @xeokit/scene!SceneObject | SceneObject} - useful for building k-d trees, finding intersections etc.
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
 * * [SceneGeometry Compression](#geometry-compression)
 * * [SceneTexture Compression](#texture-compression)
 *
 * ### Creating a SceneModel
 *
 * In the example below, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} that will model the simple table furniture model
 * shown in the image above. Our SceneModel will get five
 * {@link @xeokit/scene!SceneObject | SceneObjects}, five {@link @xeokit/scene!SceneMesh | Meshes},
 * a {@link @xeokit/scene!SceneGeometry | SceneGeometry} and a {@link @xeokit/scene!SceneTexture | SceneTexture}.
 *
 * When we've finished constructing our SceneModel, we'll call {@link @xeokit/scene!SceneModel.build | SceneModel.build}, which
 * (asynchronously) compresses our SceneTexture.
 *
 * At that point, we can use the SceneModel. For example, we could export it to xeokit's native [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx)
 * file format using {@link "@xeokit/dtx" | saveDTX}, or view it in the Browser using a {@link "@xeokit/viewer" | Viewer}.
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/constants";
 *
 * // Scene is the container of SceneModels
 *
 * const theScene = new Scene();
 *
 * const sceneModel = theScene.createModel({
 *   id: "theModel"
 * });
 *
 * if (sceneModel instanceof SDKError) {
 *
 *      // Most SDK methods return an SDKError when
 *      // something goes wrong.
 *
 *      // We'll use some SDKErrors in this example
 *      // to demonstrate where we can use them.
 *
 *      console.log(sceneModel.message);
 *
 * } else {
 *
 *      const geometry = sceneModel.createGeometry({
 *          id: "boxGeometry",
 *          primitive: TrianglesPrimitive,
 *          positions: [ // Floats
 *              1, 1, 1, -1, 1, 1,
 *              -1, -1, 1, 1, -1, 1, 1,
 *              -1, -1, 1, 1, -1, -1, 1, -1, -1,
 *              -1, -1
 *          ],
 *          indices: [
 *              0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
 *              6, 7, 8, 9, 10, 8, 10, 11, 12,
 *              13, 14, 12, 14, 15, 16, 17, 18,
 *              16, 18, 19, 20, 21, 22, 20, 22, 23
 *          ]
 *      });
 *
 *      if (geometry instanceof SDKError) {
 *          console.log(geometry.message);
 *      }
 *
 *      const texture = sceneModel.createTexture({
 *          id: "colorTexture",
 *          src: "./assets/sample_etc1s.ktx2",
 *          preloadColor: [1, 0, 0, 1],
 *          flipY: false,
 *          encoding: LinearEncoding,
 *          magFilter: LinearFilter,
 *          minFilter: LinearFilter,
 *          wrapR: ClampToEdgeWrapping,
 *          wrapS: ClampToEdgeWrapping,
 *          wrapT: ClampToEdgeWrapping,
 *      });
 *
 *      if (texture instanceof SDKError) {
 *          console.log(texture.message);
 *      }
 *
 *      const theTextureSet = sceneModel.createTextureSet({
 *          id: "theTextureSet",
 *          colorTextureId: "colorTexture"
 *      });
 *
 *      if (theTextureSet instanceof SDKError) {
 *          console.log(theTextureSet.message);
 *      }
 *
 *      const redLegMesh = sceneModel.createLayerMesh({
 *          id: "redLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [-4, -6, -4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [1, 0.3, 0.3],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      if (redLegMesh instanceof SDKError) {
 *          console.log(redLegMesh.message);
 *      }
 *
 *      const greenLegMesh = sceneModel.createLayerMesh({
 *          id: "greenLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [4, -6, -4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [0.3, 1.0, 0.3],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const blueLegMesh = sceneModel.createLayerMesh({
 *          id: "blueLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [4, -6, 4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [0.3, 0.3, 1.0],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const yellowLegMesh = sceneModel.createLayerMesh({
 *          id: "yellowLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [-4, -6, 4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [1.0, 1.0, 0.0],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const tableTopMesh = sceneModel.createLayerMesh({
 *          id: "tableTopMesh",
 *          geometryId: "boxGeometry",
 *          position: [0, -3, 0],
 *          scale: [6, 0.5, 6],
 *          rotation: [0, 0, 0],
 *          color: [1.0, 0.3, 1.0],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      // Create five SceneObjects, each using a SceneMesh.
 *      // A SceneMesh belongs to exactly one SceneObject.
 *
 *      const redLegSceneObject = sceneModel.createObject({
 *          id: "redLegObject",
 *          meshIds: ["redLegMesh"]
 *      });
 *
 *      if (redLegSceneObject instanceof SDKError) {
 *          console.log(redLegSceneObject.message);
 *      }
 *
 *      const greenLegSceneObject = sceneModel.createObject({
 *          id: "greenLegObject",
 *          meshIds: ["greenLegMesh"]
 *      });
 *
 *      const blueLegSceneObject = sceneModel.createObject({
 *          id: "blueLegObject",
 *          meshIds: ["blueLegMesh"]
 *      });
 *
 *      const yellowLegSceneObject = sceneModel.createObject({
 *          id: "yellowLegObject",
 *          meshIds: ["yellowLegMesh"]
 *      });
 *
 *      const tableTopSceneObject = sceneModel.createObject({
 *          id: "tableTopObject",
 *          meshIds: ["tableTopMesh"]
 *      });
 *
 *      // Expect an event when we build the SceneModel
 *
 *      sceneModel.onBuilt.subscribe((theSceneModel)=>{ });
 *
 *      // Expect an event when we destroy the SceneModel
 *
 *      sceneModel.onDestroyed.subscribe((theSceneModel)=>{ });
 *
 *      // Now build the SceneModel
 *
 *      sceneModel.build().then(()=> {
 *           // SceneModel is ready for use
 *
 *      }).catch((sdkError) => {
 *          console.log(sdkError.message);
 *       });
 * }
 * ````
 *
 * ### Reading the SceneModel
 *
 * Now that we've built our SceneModel, we can read all of its components. Note that the {@link @xeokit/scene!SceneTexture} and {@link @xeokit/scene!SceneGeometry}
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
 * ### SceneGeometry Compression
 *
 * The geometry from our query example requires a closer look. Internally, the {@link @xeokit/scene!SceneModel.createGeometry}
 * method uses the {@link @xeokit/scene!compressGeometryParams} function to compress the geometry and generate edge indices for
 * rendering it as a wireframe.
 *
 * We provide that function as part of the API in case users want to pre-compress the geometry themselves
 * and then use {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * to create the compressed geometry directly.
 *
 * The {@link @xeokit/scene!compressGeometryParams} function performs these steps to compress the geometry:
 *
 * * Simplifies geometry by combining duplicate positions and adjusting indices
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Quantizes positions and UVs as 16-bit unsigned integers
 * * Splits geometry into {@link @xeokit/scene!SceneGeometryBucketParams | buckets } to enable indices to use the minimum bits for storage
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
 * In the example below, we'll now use {@link @xeokit/scene!compressGeometryParams} to compress
 * a {@link @xeokit/scene!SceneGeometryParams | SceneGeometryParams} into a
 * {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * In this example, our geometry is very simple, and our SceneGeometryCompressedParams only gets a single
 * {@link @xeokit/scene!SceneGeometryBucketParams | SceneGeometryBucketParams }. Note that if the
 * {@link @xeokit/scene!SceneGeometryParams.positions | SceneGeometryParams.positions} array was large enough to require
 * some indices to use more than 16 bits for storage, then that's when the function's bucketing mechanism would
 * kick in, to split the geometry into smaller buckets, each with smaller indices that index a subset of the positions.
 *
 * ````javascript
 * import {compressGeometryParams} from "@xeokit/compression";
 * import {TrianglesPrimitive} from "@xeokit/constants";
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
 * The value of our new {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams} is shown below.
 *
 * We can see that:
 *
 * * We get one bucket, because we have only a small number of indices
 * * Vertex positions are now quantized to 16-bit integers
 * * Duplicate positions are removed and indices adjusted
 * * Edge indices generated for our TrianglesPrimitive
 * * A ````positionsDecompressMatrix```` to de-quantize the positions within the Viewer
 *
 * ````javascript
 * {
 *      id: "boxGeometry",
 *      primitive: TrianglesPrimitive,
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
 * ### SceneTexture Compression
 *
 * The {@link @xeokit/scene!SceneTexture} from our query example also requires a closer look. Internally, the {@link @xeokit/scene!SceneModel.build}
 * method uses [Basis](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#basis) to compress the SceneTexture to [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2). We can now read that transcoded data
 * back from {@link @xeokit/scene!SceneTexture.buffers | SceneTexture.buffers}:
 *
 * ````javascript
 * const theTexture = theSceneModel.textures["theColorTexture"];
 *
 * const buffers = thetexture.buffers; // ArrayBuffer[]
 * ````
 *
 * ### Preparing a SceneModel for Progressive Loading
 *
 * TODO: Create in separate tutorial - too complex for here
 *
 * @module @xeokit/scene
 */

export * from "./Scene";
export * from "./SceneModel";
export * from "./SceneModelStats";
export * from "./SceneObject";
export * from "./SceneTexture";
export * from "./SceneTextureSet";
export * from "./SceneGeometry";
export * from "./SceneGeometryBucket";
export * from "./SceneMesh";

export * from "./RendererGeometry";
export * from "./RendererMesh";
export * from "./RendererObject";
export * from "./RendererModel";
export * from "./RendererTexture";
export * from "./RendererTextureSet";

export * from "./SceneMeshParams";
export * from "./SceneObjectParams";
export * from "./SceneTextureParams";
export * from "./SceneTextureSetParams";
export * from "./SceneTransformParams";
export * from "./SceneGeometryBucketParams";
export * from "./SceneGeometryCompressedParams";
export * from "./SceneGeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";

export * from "./getSceneObjectGeometry";

export * from "./SceneModelStreamParams";
export * from "./SceneModelStreamLayerParams";
