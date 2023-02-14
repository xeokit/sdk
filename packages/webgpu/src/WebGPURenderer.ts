import {Capabilities, SceneModel, TextureTranscoder} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";

import {ModelParams, Renderer, View, Viewer, ViewObject} from "@xeokit/viewer";
import type {Pickable} from "./Pickable";

/**
 * WebGPU-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link @xeokit/webgpu} for usage.
 */
export class WebGPURenderer implements Renderer {

    /**
     Creates a WebGPURenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link ViewerModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link ViewerModel.createTexture}. We assume that all transcoded texture data added to a  ````ViewerModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder
    }) {

        // TODO
    }

    init(viewer: Viewer): void {
        // TODO
    }

    getCapabilities(capabilities: Capabilities): void {
        // TODO
    }

    registerView(view: View): number {
        // TODO
        return 0;
    }

    deregisterView(viewIndex: number): void { // Nop
    }

    createModel(params: ModelParams): SceneModel {
        throw "TODO";
    }

    /**
     * @private
     */
    registerPickable(pickable: Pickable): number { // @ts-ignore
        throw "TODO";
    }

    /**
     * @private
     */
    deregisterPickable(pickId: number) {
        throw "TODO";
    }

    setImageDirty(viewIndex?: number) {
        throw "TODO";
    }

    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void { // @ts-ignore
        throw "TODO";
    }

    setEdgesEnabled(viewIndex: number, enabled: boolean): void {
        throw "TODO";
    }

    setPBREnabled(viewIndex: number, enabled: boolean): void {
        throw "TODO";
    }

    getSAOSupported(): boolean {
        throw "TODO";
    }

    setSAOEnabled(viewIndex: number, enabled: boolean): void {
        throw "TODO";
    }

    setTransparentEnabled(viewIndex: number, enabled: boolean): void {
        throw "TODO";
    }

    clear(viewIndex: number) {
        throw "TODO";
    };

    needsRebuild(viewIndex?: number): void {
        throw "TODO";
    }

    needsRender(viewIndex?: number): boolean {
        throw "TODO";
    }

    render(viewIndex: number, params: {
        force?: boolean;
    }) {
        throw "TODO";
    }

    pickSceneObject(viewIndex: number, params: {}): ViewObject | null {
        throw "TODO";
    };
}