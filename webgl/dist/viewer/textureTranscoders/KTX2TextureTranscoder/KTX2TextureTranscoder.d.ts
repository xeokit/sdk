import { CompressedTextureParams, WebViewerCapabilities } from "../../index";
import type { TextureTranscoder } from "../TextureTranscoder";
/**
 * KTX2 texture data transcoding strategy.
 *
 * A {@link Renderer} implementation usually has one of these, so that it can create compressed textures from transcoded
 * KTX2 texture data via {@link ViewerModel.createTexture}.
 *
 * By default, a {@link WebViewer} has an internal {@link WebGLRenderer}, which has a {@link KTX2TextureTranscoder}.
 *
 * ## Overview
 *
 * * Uses the [Basis Universal GPU Texture Codec](https://github.com/BinomialLLC/basis_universal) to
 * transcode [KTX2](https://github.khronos.org/KTX-Specification/) textures.
 * * Loads the Basis Codec from [CDN](https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/basis/) by default, but can
 * also be configured to load the Codec from local files.
 * * We also bundle the Basis Codec with the xeokit-viewer npm package, and in the [repository](https://github.com/xeokit/xeokit-viewer/tree/master/dist/basis).
 *
 * ## What is KTX2?
 *
 * A [KTX2](https://github.khronos.org/KTX-Specification/) file stores GPU texture data in the Khronos Texture 2.0 (KTX2) container format. It contains image data for
 * a texture asset compressed with Basis Universal (BasisU) supercompression that can be transcoded to different formats
 * depending on the support provided by the target devices. KTX2 provides a lightweight format for distributing texture
 * assets to GPUs. Due to BasisU compression, KTX2 files can store any image format supported by GPUs.
 *
 * ## Loading XKT files containing KTX2 textures
 *
 * ````javascript
 * const myViewer = new WebViewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ // Optional
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
 * const xktLoader = new TreeViewPlugin(viewer);
 *
 * const viewerModel = xktLoader.load({
 *     id: "myModel",
 *     src: "./HousePlan.xkt" // <<------ XKT file with KTX2 textures
 * });
 * ````
 *
 * ## Loading KTX2 files into a ViewerModel
 *
 * ````javascript
 * const myViewer = new WebViewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ // Optional
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
 * const viewerModel = myViewer.scene.createModel({
 *      id: "myModel"
 *  });
 *
 * viewerModel.createTexture({
 *      id: "myColorTexture",
 *      src: "sample_uastc_zstd.ktx2" // <<----- KTX2 texture asset
 * });
 *
 * viewerModel.createTexture({
 *      id: "myMetallicRoughnessTexture",
 *      src: "crosshatchAlphaMap.jpg" // <<----- JPEG texture asset
 * });
 *
 * viewerModel.createTextureSet({
 *      id: "myTextureSet",
 *      colorTextureId: "myColorTexture",
 *      metallicRoughnessTextureId: "myMetallicRoughnessTexture"
 *  });
 *
 * viewerModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [1, 1, 1, ...],
 *     normals: [0, 0, 1, 0, ...],
 *     uv: [1, 0, 0, ...],
 *     indices: [0, 1, 2, ...],
 * });
 *
 * viewerModel.createMesh({
 *      id: "myMesh",
 *      textureSetId: "myTextureSet",
 *      geometryId: "myGeometry"
 *  });
 *
 * viewerModel.createObject({
 *      id: "myObject",
 *      meshIds: ["myMesh"]
 *  });
 *
 * viewerModel.build();
 * ````
 *
 * ## Loading KTX2 ArrayBuffers into a ViewerModel
 *
 * ````javascript
 * const myViewer = new WebViewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ // Optional
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
 * const viewerModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * utils.loadArraybuffer("sample_uastc_zstd.ktx2",(arrayBuffer) => {
 *
 *      viewerModel.createTexture({
 *         id: "myColorTexture",
 *         buffers: [arrayBuffer] // <<----- KTX2 texture asset
 *      });
 *
 *      viewerModel.createTexture({
 *         id: "myMetallicRoughnessTexture",
 *         src: "../assets/textures/alpha/crosshatchAlphaMap.jpg" // <<----- JPEG texture asset
 *      });
 *
 *      viewerModel.createTextureSet({
 *        id: "myTextureSet",
 *        colorTextureId: "myColorTexture",
 *        metallicRoughnessTextureId: "myMetallicRoughnessTexture"
 *      });
 *
 *      viewerModel.createGeometry({
 *          id: "myGeometry",
 *          primitive: constants.TrianglesPrimitive,
 *          positions: [1, 1, 1, ...],
 *          normals: [0, 0, 1, 0, ...],
 *          uv: [1, 0, 0, ...],
 *          indices: [0, 1, 2, ...],
 *      });
 *
 *      viewerModel.createMesh({
 *          id: "myMesh",
 *          textureSetId: "myTextureSet",
 *          geometryId: "myGeometry"
 *      });
 *
 *      viewerModel.createObject({
 *          id: "myObject",
 *          meshIds: ["myMesh"]
 *      });
 *
 *      viewerModel.build();
 * });
 * ````
 */
export declare class KTX2TextureTranscoder implements TextureTranscoder {
    #private;
    /**
     * Creates a new KTX2TextureTranscoder.
     *
     * @param {String} [params.transcoderPath="https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/basis/"] Path to the Basis
     * transcoder module that internally does the heavy lifting for our KTX2TextureTranscoder. If we omit this configuration,
     * then our KTX2TextureTranscoder will load it from ````https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/basis/```` by
     * default. Therefore, make sure your application is connected to the internet if you wish to use the default transcoder path.
     * @param {Number} [params.workerLimit] The maximum number of Workers to use for transcoding.
     */
    constructor(params: {
        transcoderPath?: string;
        workerLimit?: number;
    });
    /**
     * Called by {@link Renderer} to initialize this transcoder.
     *
     * @param viewerCapabilities
     */
    init(viewerCapabilities: WebViewerCapabilities): void;
    /**
     * Transcodes texture data from transcoded buffers.
     *
     * @param {ArrayBuffer[]} buffers Transcoded input texture data. Given as an array of buffers so that we can support multi-image textures, such as cube maps.
     * @param {*} config Transcoding options.
     * @returns {Promise<CompressedTextureParams>} Transcoded output texture data.
     */
    transcode(buffers: ArrayBuffer[], config?: {}): Promise<CompressedTextureParams>;
    /**
     * Destroys this KTX2TextureTranscoder
     */
    destroy(): void;
}
