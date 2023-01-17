import { math, Renderer, SceneModel, SceneModelParams, SceneObject, View, WebViewer, WebViewerCapabilities, TextureTranscoder } from "../viewer/index";
import type { Pickable } from "./Pickable";
/**
 * Pluggable WebGL-based rendering strategy for a {@link WebViewer}.
 *
 * Handles creation and rendering of geometry and materials for a WebViewer, using the browser's WebGL 3D graphics API.
 *
 * ## Usage
 *
 * ````javascript
 * import {WebViewer, WebGLRenderer} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *          textureTranscoder: new KTX2TextureTranscoder({
 *              transcoderPath: "./../dist/basis/" // <------ Path to BasisU transcoder module
 *          })
 *     })
 * });
 * ````
 */
export declare class WebGLRenderer implements Renderer {
    #private;
    /**
     Creates a WebGLRenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link SceneModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link SceneModel.createTexture}. We assume that all transcoded texture data added to a  ````SceneModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder;
    });
    init(viewer: WebViewer): void;
    getCapabilities(capabilities: WebViewerCapabilities): void;
    registerView(view: View): number;
    deregisterView(viewIndex: number): void;
    createModel(params: SceneModelParams): SceneModel;
    /**
     * @private
     */
    registerPickable(pickable: Pickable): number;
    /**
     * @private
     */
    deregisterPickable(pickId: number): void;
    setImageDirty(viewIndex?: number): void;
    setBackgroundColor(viewIndex: number, color: math.FloatArrayParam): void;
    setEdgesEnabled(viewIndex: number, enabled: boolean): void;
    setPBREnabled(viewIndex: number, enabled: boolean): void;
    getSAOSupported(): boolean;
    setSAOEnabled(viewIndex: number, enabled: boolean): void;
    setTransparentEnabled(viewIndex: number, enabled: boolean): void;
    clear(viewIndex: number): void;
    needsRebuild(viewIndex?: number): void;
    needsRender(viewIndex?: number): boolean;
    render(viewIndex: number, params: {
        force?: boolean;
    }): void;
    pickSceneObject(viewIndex: number, params: {}): SceneObject | null;
}
