import type { FloatArrayParam } from "@xeokit/math";
import type { Renderer, RendererViewObject, View, Viewer, ViewObject } from "@xeokit/viewer";
import type { Pickable } from "./Pickable";
import type { Capabilities, TextureTranscoder } from "@xeokit/core";
import type { SceneModel } from "@xeokit/scene";
import { TileManager } from "./TileManager";
/**
 * WebGL-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link @xeokit/webglrenderer} for usage.
 */
export declare class WebGLRenderer implements Renderer {
    #private;
    /**
     * A RendererViewObject is an interface through which a ViewObject can push updates
     * to its object representation within the Renderer.
     */
    rendererViewObjects: {
        [key: string]: RendererViewObject;
    };
    tileManager: TileManager | null;
    /**
     Creates a WebGLRenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link rendererModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link rendererModel.createTexture}. We assume that all transcoded texture data added to a  ````rendererModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder;
    });
    getCapabilities(capabilities: Capabilities): void;
    attachViewer(viewer: Viewer): void;
    attachView(view: View): number;
    detachView(viewIndex: number): void;
    attachSceneModel(sceneModel: SceneModel): void;
    detachSceneModel(sceneModel: SceneModel): void;
    /**
     * @private
     */
    attachPickable(pickable: Pickable): number;
    /**
     * @private
     */
    detachPickable(pickId: number): void;
    setImageDirty(viewIndex?: number): void;
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void;
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
    pickSceneObject(viewIndex: number, params: {}): ViewObject | null;
}
