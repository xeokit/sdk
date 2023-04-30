import { FloatArrayParam } from "@xeokit/math";
import { CreateModelParams, Renderer, View, Viewer, ViewObject } from "@xeokit/viewer";
import { RendererViewObject } from "viewer/src/RendererViewObject";
import type { Pickable } from "./Pickable";
import { Capabilities, TextureTranscoder } from "@xeokit/core";
/**
 * WebGPU-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link @xeokit/webgpu} for usage.
 */
export declare class WebGPURenderer implements Renderer {
    /**
     Creates a WebGPURenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link ViewerModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link ViewerModel.createTexture}. We assume that all transcoded texture data added to a  ````ViewerModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder;
    });
    rendererViewObjects: {
        [key: string]: RendererViewObject;
    };
    addModel(params: CreateModelParams): void;
    removeModel(id: string): void;
    init(viewer: Viewer): void;
    getCapabilities(capabilities: Capabilities): void;
    registerView(view: View): number;
    deregisterView(viewIndex: number): void;
    /**
     * @private
     */
    registerPickable(pickable: Pickable): number;
    /**
     * @private
     */
    deregisterPickable(pickId: number): void;
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
