/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fktx2.svg)](https://badge.fury.io/js/%40xeokit%2Fktx2)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/ktx2/badge)](https://www.jsdelivr.com/package/npm/@xeokit/ktx2)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:140px;" src="media://images/xeokit_ktx_logo.svg"/>
 *
 * # xeokit KTX2 SceneTexture Transcoder
 *
 * ---
 *
 * ### *Enables the xeokit Viewer to load KTX2-compressed textures*
 *
 * ---
 *
 * * Provides {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}
 * * Configure a {@link @xeokit/viewer!Viewer | Viewer} with a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer} that has a {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}
 * * Then a Viewer is able to view a {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture} that has KTX2-encoded compressed textures
 * * Uses the [Basis Universal GPU SceneTexture Codec](https://github.com/BinomialLLC/basis_universal) to
 * transcode [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) textures.
 * * Loads the Basis Codec from [CDN](https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/) by default, but can
 * also be configured to load the Codec from local files.
 * * We also bundle the Basis Codec with the xeokit-viewer npm package, and in the [repository](https://github.com/xeokit/sdk/tree/master/dist/basis).
 *
 * ### What is KTX2?
 *
 * A [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) file stores GPU texture data in the Khronos SceneTexture 2.0 (KTX2) container format. It contains image data for
 * a texture asset compressed with Basis Universal (BasisU) supercompression that can be transcoded to different formats
 * depending on the support provided by the target devices. [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) provides a lightweight format for distributing texture
 * assets to GPUs. Due to BasisU compression, [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) files can store any image format supported by GPUs.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt?type=png)](https://mermaid.live/edit#pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/ktx2
 * ````
 *
 * ## Usage
 *
 * ### Loading an XGF file containing [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) textures into a Viewer
 *
 * Create a {@link @xeokit/viewer!Viewer | Viewer} with a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer} configured with a
 * {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}. Then create a {@link @xeokit/scene!SceneModel | SceneModel} within the Viewer, and use {@link loadXGF} to
 * load a [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file with KTX2-compressed textures into the SceneModel. For each [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) texture in the file, the
 * KTX2TextureTranscoder will transparently transcode the [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) data for us.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/ktx2";
 * import {loadXGF} from "@xeokit/xgf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderers: new WebGLRenderer({ // Optional
 *          textureTranscoder: new KTX2TextureTranscoder({
 *              transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myCanvas1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * const sceneModel= myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModelWithTextures.xgf") // <<-- [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file with KTX2 textures
 *     .then(response => {
 *          if (response.ok) {
 *              loadXGF(response.arrayBuffer(), sceneModel);
 *              sceneModel.build();
 *          }
 *     });
 * ````
 *
 * ### Loading KTX2 texture files into a Viewer
 *
 * As in the previous example, create a {@link @xeokit/viewer!Viewer | Viewer} with a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer} configured with a
 * {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}, then create a {@link @xeokit/scene!SceneModel | SceneModel} within the Viewer.
 *
 * This time, we'll build the SceneModel ourselves, using its builder methods. When we
 * call builder method {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture} with a path to a KTX2-compressed texture file, the
 * KTX2TextureTranscoder will transparently transcode that KTX2 data for us.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/ktx2";
 * import {loadXGF} from "@xeokit/xgf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderers: new WebGLRenderer({ // Optional
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 *  });
 *
 * sceneModel.createTexture({
 *      id: "myColorTexture",
 *      src: "sample_uastc_zstd.ktx2" // <<----- KTX2 texture asset
 * });
 *
 * sceneModel.createTexture({
 *      id: "myMetallicRoughnessTexture",
 *      src: "crosshatchAlphaMap.jpg" // <<----- JPEG texture asset
 * });
 *
 * sceneModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture",
 *      metallicRoughnessTextureId: "myMetallicRoughnessTexture"
 *  });
 *
 * sceneModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: TrianglesPrimitive,
 *     positions: [1, 1, 1, ...],
 *     normals: [0, 0, 1, 0, ...],
 *     uv: [1, 0, 0, ...],
 *     indices: [0, 1, 2, ...],
 * });
 *
 * sceneModel.createLayerMesh({
 *      id: "myMesh",
 *      textureSetId: "myTextureSet",
 *      geometryId: "myGeometry"
 *  });
 *
 * sceneModel.createObject({
 *      id: "myObject",
 *      meshIds: ["myMesh"]
 *  });
 *
 * sceneModel.build();
 * ````
 *
 * ### Loading [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) texture ArrayBuffers into a Viewer
 *
 * As in the previous two examples, create a {@link @xeokit/viewer!Viewer | Viewer} that has a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer} configured with a
 * {@link @xeokit/ktx2!KTX2TextureTranscoder | KTX2TextureTranscoder}, and then create a {@link @xeokit/scene!SceneModel | SceneModel} within the Viewer.
 *
 * Once more, build the SceneModel using its builder methods. This time, call builder method
 * {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture} with an ArrayBuffer containing the contents of a KTX2-compressed texture
 * file. As before, the KTX2TextureTranscoder will transparently transcode that [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) data for us.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {KTX2TextureTranscoder} from "@xeokit/ktx2";
 * import {loadXGF} from "@xeokit/xgf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderers: new WebGLRenderer({ // Optional
 *          textureTranscoder: new KTX2TextureTranscoder({ // Optional
 *              transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
 *          })
 *     })
 * });
 *
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * fetch("sample_uastc_zstd.ktx2") // // <<----- KTX2 texture asset
 *     .then(response => {
 *          if (response.ok) {
 *
 *              sceneModel.createTexture({
 *                  id: "myColorTexture",
 *                  buffers: [arrayBuffer] // <<----- KTX2 texture asset
 *              });
 *
 *              sceneModel.createTexture({
 *                  id: "myMetallicRoughnessTexture",
 *                  src: "../assets/textures/alpha/crosshatchAlphaMap.jpg" // <<----- JPEG texture asset
 *              });
 *
 *              sceneModel.createTextureSet({
 *                  id: "myTextureSet",
 *                  colorTextureId: "myColorTexture",
 *                  metallicRoughnessTextureId: "myMetallicRoughnessTexture"
 *              });
 *
 *              sceneModel.createGeometry({
 *                  id: "myGeometry",
 *                  primitive: TrianglesPrimitive,
 *                  positions: [1, 1, 1, ...],
 *                  normals: [0, 0, 1, 0, ...],
 *                  uv: [1, 0, 0, ...],
 *                  indices: [0, 1, 2, ...],
 *              });
 *
 *              sceneModel.createLayerMesh({
 *                  id: "myMesh",
 *                  textureSetId: "myTextureSet",
 *                  geometryId: "myGeometry"
 *              });
 *
 *              sceneModel.createObject({
 *                  id: "myObject",
 *                  meshIds: ["myMesh"]
 *              });
 *
 *              sceneModel.build();
 *          }
 *     });
 * ````
 *
 * @module @xeokit/ktx2
 */
export * from "./KTX2TextureTranscoder";
