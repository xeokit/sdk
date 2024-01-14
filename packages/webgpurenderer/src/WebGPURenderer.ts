import {FloatArrayParam} from "@xeokit/math";

import { Renderer, View, Viewer, ViewObject} from "@xeokit/viewer";
import {RendererObject} from "@xeokit/viewer";
import type {Pickable} from "./Pickable";
import {Capabilities, SDKError, TextureTranscoder} from "@xeokit/core";
import { SceneModel } from "@xeokit/scene";

/**
 * WebGPU-based rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link @xeokit/webgpurenderer} for usage.
 */
export class WebGPURenderer implements Renderer {

    /**
     Creates a WebGPURenderer.

     @param params Configs
     @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link SceneModel.createTexture}
     to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     to {@link SceneModel.createTexture}. We assume that all transcoded texture data added to a  ````SceneModel````
     will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder
    }) {

        // TODO
    }

    attachViewer(viewer: Viewer): void {
        throw new Error("Method not implemented.");
    }
    attachView(view: View): number {
        throw new Error("Method not implemented.");
    }

    detachView(viewIndex: number): SDKError {
        throw new Error("Method not implemented.");
    }
    attachSceneModel(sceneModel: SceneModel): void {
        throw new Error("Method not implemented.");
    }

    detachSceneModel(sceneModel: SceneModel): void {
        throw new Error("Method not implemented.");
    }

    rendererObjects: { [key: string]: RendererObject; };

    getCapabilities(capabilities: Capabilities): void {
        // TODO
    }

    registerView(view: View): number {
        // TODO
        return 0;
    }

    deregisterView(viewIndex: number): void { // Nop
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

    pickViewObject(viewIndex: number, params: {}): ViewObject | null {
        throw "TODO";
    };
}