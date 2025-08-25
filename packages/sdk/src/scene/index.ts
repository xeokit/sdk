/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit 3D Scene Representation
 *
 * ---
 *
 * ***The SDK's buildable, viewable, importable and exportable 3D scene representation***
 *
 * ---
 *
 * # Overview
 *
 * The xeokit SDK represents models in a scene graph that include the model's 3D objects, geometries, and materials. This scene
 * graph works on both the browser and NodeJS platforms and can be used to create models, convert between model formats, and provide
 * content for the SDK's model Viewer.
 *
 * To elaborate further:
 *
 * * The {@link Scene | Scene} acts as a container for {@link SceneModel | SceneModels}, which, in turn,
 * comprise {@link SceneObject | SceneObjects}, {@link SceneMesh | SceneMeshes}, {@link SceneGeometry | SceneGeometries}, and {@link SceneTexture | SceneTextures}.
 * * Optionally attach the Scene to a {@link viewer!Viewer | Viewer} to view it in the browser.
 * * Import and export various formats, including {@link gltf}, {@link las}, {@link cityjson}, {@link xgf}, {@link dotbim} and {@link ifc}.
 * * Create Scene content programmatically using builder methods.
 *
 * <br>
 *
 * ````mermaid
 * classDiagram
 * direction LR
 *       class Scene{
 *           createModel()
 *           clear()
 *           models
 *           objects
 *       }
 *       class SceneModel{
 *         id
 *         objects
 *          meshes
 *          geometries
 *          textureSets
 *          textures
 *         createObject()
 *         createMesh()
 *         createGeometry()
 *         createTexture()
 *         createTextureSet()
 *         destroy()
 *       }
 *       class SceneObject{
 *           id
 *           meshes
 *           aabb
 *           destroy()
 *       }
 *       class SceneMesh {
 *         id
 *         color
 *         opacity
 *         matrix
 *         geometry
 *         textureSet
 *         destroy()
 *       }
 *       class SceneTexture {
 *         id,
 *         destroy()
 *       }
 *       class SceneTextureSet {
 *         id
 *         colorTexture
 *         metallicRoughnessTexture
 *         occlusionTexture
 *         emissiveTexture,
 *         destroy()
 *       }
 *       class SceneGeometry {
 *         id
 *         primitive
 *         positionsDecompressMatrix
 *         uvsDecompressMatrix
 *         positionsCompressed
 *         uvsCompressed
 *         indices
 *         edgeIndices,
 *         destroy()
 *       }
 *
 *       Scene "1"*--"1..*" SceneModel
 *       SceneModel "1"*--"1..*" SceneObject
 *       Scene "1"*--"1..*" SceneObject
 *       SceneObject "1"*--"1..*" SceneMesh
 *       SceneMesh "1"*--"1" SceneGeometry
 *       SceneTextureSet "1"*--"1..4" SceneTexture
 *       SceneMesh "1"*--"1" SceneTextureSet
 * ````
 *
 * https://www.mermaidchart.com/app/projects/acbb2919-d662-4e57-864f-e34ca6330603/diagrams/d779eb15-f412-426e-a4fb-65e59381dad5/version/v0.1/edit
 * [![](https://mermaid.ink/img/pako:eNqNVEuPmzAQ_ivIp3bFog1xeF270qpSo0qbPVVcHHuauAKMbLNKGuW_17wSQwAVDoZvvnmP54KoYIASRDOi1CsnB0nytGBcAtVcFM6P97RwmqdhODsKBVx6rMElEA1bYyb78nUgyIDIIZTXLGUjYv_HeLpB1wlvjWnLJWf375F67QLUEWzgACIHLfkA1HDSlYQd6AnUgtrkfjZe7FS6pI2vR_StdXh-lHy09mcFJhxbtq94xmyAgdJSWIanytUGO2iRXbGJCjmE7PeLHTAazkwHqMiEtBpSEsr1-Q7kxNT-dP_v2mEx7r1YiqEr0XQYCwrG7GLoHc0KGDTJMk7fRXU4FqDUA0NQmlXK3I4HCeRcKf4JI8FUeP2UzAVXSp5zbWxZkFC8vpTqFajISzOoajuqbvW5ILzpf-sIwAaaUzA3u4Da0wLsAN-H4C29_mwSdFK0StHT87M5Pe8pRdZtHhAbZIbdDvP_2J1gttBcHGamh2HUQ25xe-LbaGDHwzUwj3ut0QQseviwLkD9tirIRTnInHBm1nMzJCnSR8ghRYn5ZPCbVJlOUVpcDZVUWuzOBUWJlhW4qCqZ2SvdQu9BYFwLue02fn24qCQFSi7ohBI_ePFWqxBHgb-J1zhcYxedDbz2cBwGEY7xKorCOPKvLvorhLH64kV-gHHgxziM8AZv4sber0ZYu7z-A6rh2zE?type=png)](https://mermaid.live/edit#pako:eNqNVEuPmzAQ_ivIp3bFog1xeF270qpSo0qbPVVcHHuauAKMbLNKGuW_17wSQwAVDoZvvnmP54KoYIASRDOi1CsnB0nytGBcAtVcFM6P97RwmqdhODsKBVx6rMElEA1bYyb78nUgyIDIIZTXLGUjYv_HeLpB1wlvjWnLJWf375F67QLUEWzgACIHLfkA1HDSlYQd6AnUgtrkfjZe7FS6pI2vR_StdXh-lHy09mcFJhxbtq94xmyAgdJSWIanytUGO2iRXbGJCjmE7PeLHTAazkwHqMiEtBpSEsr1-Q7kxNT-dP_v2mEx7r1YiqEr0XQYCwrG7GLoHc0KGDTJMk7fRXU4FqDUA0NQmlXK3I4HCeRcKf4JI8FUeP2UzAVXSp5zbWxZkFC8vpTqFajISzOoajuqbvW5ILzpf-sIwAaaUzA3u4Da0wLsAN-H4C29_mwSdFK0StHT87M5Pe8pRdZtHhAbZIbdDvP_2J1gttBcHGamh2HUQ25xe-LbaGDHwzUwj3ut0QQseviwLkD9tirIRTnInHBm1nMzJCnSR8ghRYn5ZPCbVJlOUVpcDZVUWuzOBUWJlhW4qCqZ2SvdQu9BYFwLue02fn24qCQFSi7ohBI_ePFWqxBHgb-J1zhcYxedDbz2cBwGEY7xKorCOPKvLvorhLH64kV-gHHgxziM8AZv4sber0ZYu7z-A6rh2zE)
 *
 * <br>
 *
 * ### Notes
 *
 * * SceneTextureSets are collections of textures that are shared among SceneMeshes and are organized into texture atlasses to optimize rendering efficiency on GPUs.
 * * Each SceneMesh can be assigned to only one SceneObject, whereas each SceneGeometry and SceneTextureSet can be allocated to an unlimited number of SceneMeshes.
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 * <br>
 *
 * ## Import Modules
 *
 * First we'll import the modules we'll need:
 *
 * ````javascript
 * import {Scene} from "@xeokit/sdk/scene";
 * import {TrianglesPrimitive, LinearEncoding, LinearFilter, ClampToEdgeWrapping} from "@xeokit/sdk/constants";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * ````
 * <br>
 *
 * ## Creating a Scene
 *
 * Next, we'll create a {@link Scene | Scene}:
 *
 * ````javascript
 * const theScene = new Scene();
 * ````
 *
 * <br>
 *
 * ## Viewing the Scene
 *
 * If we're coding in the browser, we can view our Scene by attaching it to a {@link viewer!Viewer | Viewer}, as
 * shown below. The Viewer will then provide an interactive 3D view of our Scene. As we create and destroy objects,
 * they will appear and disaapear in the view.
 *
 * Our minimal browser Viewer gets a {@link webglrenderer!WebGLRenderer | WebGLRenderer}, to adapt it
 * to use the browser's WebGL graphics API for 3D viewing. Our Viewer also gets a single {@link viewer!View | View}
 * to make it draw to a specified canvas in the page. The View also gets a {@link cameracontrol!CameraControl | CameraControl},
 * so we can interact with it using mouse and touch input.
 *
 * Note that a Scene does not need to be attached to a Viewer. A Scene functions as a stand-alone data structure, and
 * is agnostic of Viewer. In the browser, we typically use Scene with a Viewer. In a NodeJS script, that has no need to draw
 * anything, we would typically use Scene without a Viewer.
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer: new WebGLRenderer({})
 * });
 *
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     elementId: "myView1"
 * });
 *
 * view1.camera.eye = [0,0,-100];
 * view1.camera.look = [0,0,0];
 * view1.camera.up = [0,1,0];
 *
 * const myCameraControl = new CameraControl({
 *      view: view1
 * });
 * ````
 *
 * <br>
 *
 * ## Building a SceneModel
 *
 * Next, we'll create a {@link SceneModel | SceneModel} that will model the simple table object
 * shown in the image above. Our SceneModel will contain five
 * {@link SceneObject | SceneObjects}, five {@link SceneMesh | SceneMeshes},
 * one {@link SceneGeometry | SceneGeometry} and one {@link SceneTexture | SceneTexture}.
 *
 * Our SceneModel now appears in our Viewer and we can interact with it.
 *
 * ````javascript
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
 *      console.error(sceneModel.message);
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
 *          console.error(geometry.message);
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
 *          console.error(texture.message);
 *      }
 *
 *      const theTextureSet = sceneModel.createTextureSet({
 *          id: "theTextureSet",
 *          colorTextureId: "colorTexture"
 *      });
 *
 *      if (theTextureSet instanceof SDKError) {
 *          console.error(theTextureSet.message);
 *      }
 *
 *      const redLegMesh = sceneModel.addMesh({
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
 *          console.error(redLegMesh.message);
 *      }
 *
 *      const greenLegMesh = sceneModel.addMesh({
 *          id: "greenLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [4, -6, -4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [0.3, 1.0, 0.3],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const blueLegMesh = sceneModel.addMesh({
 *          id: "blueLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [4, -6, 4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [0.3, 0.3, 1.0],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const yellowLegMesh = sceneModel.addMesh({
 *          id: "yellowLegMesh",
 *          geometryId: "boxGeometry",
 *          position: [-4, -6, 4],
 *          scale: [1, 3, 1],
 *          rotation: [0, 0, 0],
 *          color: [1.0, 1.0, 0.0],
 *          textureSetId: "theTextureSet"
 *      });
 *
 *      const tableTopMesh = sceneModel.addMesh({
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
 *      // SceneModel is ready for use
 * }
 * ````
 *
 * <br>
 *
 * ## Reading the SceneModel
 *
 * Now that we've built our SceneModel, we can read all of its components.
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
 * <br>
 *
 * ## Reading Boundaries
 *
 * The classes Scene, SceneModel, SceneObject, and SceneMesh each have
 * an "aabb" property that contains their axis-aligned world-space 3D boundaries
 * (AABB).
 *
 * The SceneGeometry class has an "aabb" property that represents the geometry's local-space boundary.
 *
 * ````javascript
 * const sceneAABB = theScene.aabb; // [xmin,ymin,zmin,xmax,ymax,zmax]
 * const sceneModelAABB = theSceneModel.aabb;
 * const sceneMeshAABB = theTableTopMesh.aabb;
 * const sceneObjectAABB = theTableTopObject.aabb;
 * ````
 *
 * <br>
 *
 * ## Using Compressed Geometry
 *
 * When we created our SceneModel, the {@link SceneModel.createGeometry | SceneModel.createGeometry}
 * method internally performed some on-the-fly compression and processing of our geometry parameters.
 *
 * To speed up SceneModel creation, we may want to perform that compression in advance.
 *
 * We can use the {@link compressGeometryParams | compressGeometryParams} function to pre-compress the geometry parameters so
 * that we can then use {@link SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * instead, to create the geometry directly from the compressed parameters.
 *
 * In the example below, we'll now use {@link compressGeometryParams | compressGeometryParams} to compress
 * a {@link SceneGeometryParams | SceneGeometryParams} into a
 * {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * ````javascript
 * import {compressGeometryParams} from "@xeokit/sdk/compression";
 * import {TrianglesPrimitive} from "@xeokit/sdk/constants";
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
 * The value of our new {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams} is shown below.
 *
 * We can see that:
 *
 * * Vertex positions are now quantized to 16-bit integers
 * * Edge indices are generated for our TrianglesPrimitive
 * * Quantization range is given in axis-sligned bounding box ````aabb````, to de-quantize the positions within the Viewer
 *
 * ````javascript
 * {
 *      id: "boxGeometry",
 *      primitive: TrianglesPrimitive,
 *      aabb: [
 *          -1, -,1 -,1, 1, 1, 1
 *      ],
 *      positionsCompressed: [
 *          65525, 65525, 65525, 0, 65525, 65525,
 *          0, 0, 65525, 65525, 0, 65525, 65525,
 *          0, 0, 65525, 65525, 0, 0, 65525, 0, 0,
 *          0, 0
 *      ],
 *      indices: [
 *          0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
 *          0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
 *          4, 7, 6, 4, 6, 5
 *      ],
 *      edgeIndices: [
 *          3, 4, 0, 4, 5, 0, 5, 6,
 *          0, 6, 1, 1, 6, 7, 1, 7,
 *          3, 2, 4, 7, 6, 4, 6
 *      ]
 * }
 * ````
 *
 * We could then create a SceneGeometry from the compressed parameters like this:
 *
 * ````javascript
 * const geometry = sceneModel.createGeometryCompressed(geometryCompressedParams);
 * ````
 *
 * <br>
 *
 * ## Saving a SceneModel to a File
 *
 * We can export SceneModels to several file formats.
 *
 * For example, let's use {@link dotbim!DotBIMExporter | DotBIMExporter} to export our SceneModel to .BIM format:
 *
 * ````javascript
 * import {DotBIMLoader} from "@xeokit/sdk/dotbim";
 *
 * const exporter = new DotBIMExporter();
 *
 * exporter.write({
 *     sceneModel,
 *     dataModel,
 *     version: "1.1.0", // Optional, defaults to latest
 * }).then(fileData => {
 *     // Use fileData as needed
 * }).catch(err => {
 *     console.error(err);
 * });
 * ````
 *
 * <br>
 *
 * ## Loading a SceneModel from a File
 *
 * We can also import SceneModels from several file formats.
 *
 * For example, let's use {@link dotbim!DotBIMLoader | DotBIMLoader} to load a .BIM file into a new SceneModel:
 *
 * ````javascript
 * import {DotBIMLoader} from "@xeokit/sdk/dotbim";
 *
 * const sceneModel2 = scene.createModel({
 *     id: "mySceneModel2"
 * });
 *
 * const dotBIMLoader = new DotBIMLoader();
 *
 * fetch("model.bim")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         dotBIMLoader.load({ fileData, sceneModel, dataModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading .BIM: ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching .BIM file: ${err}`);
 *     });
 * ````
 *
 * <br>
 *
 * ## Serializing a SceneModel to JSON
 *
 * ````javascript
 *  const sceneModel2JSON = sceneModel2.toParams();
 * ````
 *
 * <br>
 *
 * ## Deserializing a SceneModel from JSON
 *
 * ````javascript
 * const sceneModel3 = sce.createSceneModel({
 *     id: "mySceneModel3"
 * });
 *
 * sceneModel3.fromParams(sceneModel2JSON);
 * ````
 *
 * <br>
 *
 * ## Destroying a SceneModel
 *
 * ````javascript
 *  sceneModel3.destroy();
 * ````
 *
 * @module scene
 */

export * from "./SceneParams";
export * from "./Scene";
export * from "./SceneModel";
export * from "./SceneModelParams";
export * from "./SceneModelStats";
export * from "./SceneObject";
export * from "./SceneTexture";
export * from "./SceneTextureSet";
export * from "./SceneGeometry";
export * from "./SceneMesh";

export * from "./RendererGeometry";
export * from "./RendererMesh";
export * from "./RendererObject";
export * from "./RendererTexture";
export * from "./RendererTextureSet";

export * from "./CoordinateSystem";
export * from "./CoordinateSystemParams";
export * from "./createCoordinateSystemTransform";

export * from "./SceneMeshParams";
export * from "./SceneObjectParams";
export * from "./SceneTextureParams";
export * from "./SceneTextureSetParams";
export * from "./SceneGeometryCompressedParams";
export * from "./SceneGeometryParams";
export * from "./SceneModelParams";
export * from "./compressGeometryParams";

export * from "./getSceneObjectGeometry";

export * from "./buildMat4"

export * from "./SceneModelParamsLoader";
export * from "./SceneModelParamsExporter";
