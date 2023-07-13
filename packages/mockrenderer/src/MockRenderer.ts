import type {FloatArrayParam} from "@xeokit/math";
import type {Renderer, RendererViewObject, View, Viewer, ViewObject} from "@xeokit/viewer";
import type {Capabilities} from "@xeokit/core";
import {Component, SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {MockRendererModel} from "./MockRendererModel";

/**
 * Mock rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link @xeokit/mockrenderer} for usage.
 */
export class MockRenderer implements Renderer {

    rendererViewObjects: { [key: string]: RendererViewObject };
    #view: View;
    #viewMatrixDirty: boolean;
    #rendererModels: any;
    #viewer: Viewer;

    /**
     Creates a MockRenderer.

     @param params Configs
     */
    constructor(params: {}) {
        this.rendererViewObjects = {};
    }

    getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 1;
        capabilities.headless = true;
    }

    attachViewer(viewer: Viewer): void {
        if (this.#viewer) {
            throw new SDKError("Only one Viewer allowed with MockRenderer");
        }
        this.#viewer = viewer;
    }

    attachView(view: View): number {
        if (this.#view) {
            throw new SDKError("Only one View allowed with MockRenderer (see WebViewerCapabilities.maxViews)");
        }
        this.#view = view;
        view.camera.onViewMatrix.sub(() => {
            this.#viewMatrixDirty = true;
        });
        return 0;
    }

    detachView(viewIndex: number): void { // Nop
    }

    attachSceneModel(sceneModel: SceneModel): void {
        const rendererModel = new MockRendererModel({
            qualityRender: false,
            id: sceneModel.id,
            sceneModel,
            view: this.#view,
            mockRenderer: this
        });
        this.#rendererModels[rendererModel.id] = rendererModel;
        this.#attachRendererViewObjects(rendererModel);
        rendererModel.onDestroyed.one((component: Component) => {
            const rendererModel = this.#rendererModels[component.id];
            delete this.#rendererModels[component.id];
            this.#detachRendererViewObjects(rendererModel);
        });
        sceneModel.rendererModel = rendererModel;
    }

    detachSceneModel(sceneModel: SceneModel): void {
        if (this.#rendererModels[sceneModel.id]) {
            const rendererModel = this.#rendererModels[sceneModel.id];
            delete this.#rendererModels[sceneModel.id];
            this.#detachRendererViewObjects(rendererModel);
            sceneModel.rendererModel = null;
        }
    }

    setImageDirty(viewIndex?: number) {
    }

    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void { // @ts-ignore
    }

    setEdgesEnabled(viewIndex: number, enabled: boolean): void {
    }

    setPBREnabled(viewIndex: number, enabled: boolean): void {
    }

    getSAOSupported(): boolean {
        return false;
    }

    setSAOEnabled(viewIndex: number, enabled: boolean): void {
    }

    setTransparentEnabled(viewIndex: number, enabled: boolean): void {
    }

    clear(viewIndex: number) {
    };

    needsRebuild(viewIndex?: number): void {
    }

    needsRender(viewIndex?: number): boolean {
        return false;
    }

    render(viewIndex: number, params: {
        force?: boolean;
    }) {
        // NOP
    }

    pickSceneObject(viewIndex: number, params: {}): ViewObject | null {
        return null;
    };

    #detachRendererViewObjects(rendererModel: any) {
        const rendererViewObjects = rendererModel.rendererViewObjects;
        for (let id in rendererViewObjects) {
            delete this.rendererViewObjects[id];
        }
    }

    #attachRendererViewObjects(rendererModel: MockRendererModel) {
        const rendererViewObjects = rendererModel.rendererViewObjects;
        for (let id in rendererViewObjects) {
            this.rendererViewObjects[id] = rendererViewObjects[id];
        }
    }
}