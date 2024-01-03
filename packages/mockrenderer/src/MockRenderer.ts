import type {FloatArrayParam} from "@xeokit/math";
import type {Renderer, RendererViewObject, View, Viewer, ViewObject} from "@xeokit/viewer";
import type {Capabilities} from "@xeokit/core";
import {Component, SDKError} from "@xeokit/core";
import type {SceneModel} from "@xeokit/scene";
import {MockRendererModel} from "./MockRendererModel";

/**
 * Mock rendering strategy for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * Plug a MockRenderer into a Viewer to effectively make it think it has a renderer, but not
 * actually render anything. This is useful for testing, and to demonstrate the API contract
 * to help you implement your own rendering strategies.
 *
 * See {@link @xeokit/mockrenderer} for usage.
 */
export class MockRenderer implements Renderer {

    /**
     * @Inheritdoc
     */
    rendererViewObjects: { [key: string]: RendererViewObject };

    #view: View|null;
    #viewMatrixDirty: boolean;
    #rendererModels: any;
    #viewer: Viewer|null;
    #onViewMat: any;

    /**
     * Creates a MockRenderer.
     *
     * @param params Configs
     */
    constructor(params: {}) {
        this.rendererViewObjects = {};
        this.#rendererModels = {};
    }

    /**
     * @Inheritdoc
     */
    getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 1;
        capabilities.headless = true;
    }

    /**
     * @Inheritdoc
     */
    attachViewer(viewer: Viewer): void | SDKError {
        if (this.#viewer) {
            return new SDKError("Only one Viewer allowed with MockRenderer");
        }
        this.#viewer = viewer;
    }

    /**
     * @Inheritdoc
     */
    attachView(view: View): number | SDKError {
        if (this.#view) {
            return new SDKError("Only one View allowed with MockRenderer (see WebViewerCapabilities.maxViews)");
        }
        this.#view = view;
        view.camera.onViewMatrix.sub(this.#onViewMat = () => {
            this.#viewMatrixDirty = true;
        });
        return 0;
    }

    /**
     * @Inheritdoc
     */
    detachView(viewIndex: number): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        this.#view.camera.onViewMatrix.unsub(this.#onViewMat);
        this.#onViewMat = null;
        this.#view = null;
    }

    /**
     * @Inheritdoc
     */
    attachSceneModel(sceneModel: SceneModel): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (sceneModel.rendererModel) {
            if (this.#rendererModels[sceneModel.id]) {
                return new SDKError("SceneModel not attached to this Renderer");
            } else {
                return new SDKError("SceneModel already attached to another Renderer");
            }
        }
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

    /**
     * @Inheritdoc
     */
    detachSceneModel(sceneModel: SceneModel): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (!sceneModel.rendererModel) {
            return new SDKError("SceneModel not attached to any Renderer");
        }
        if (!this.#rendererModels[sceneModel.id]) {
            return new SDKError("SceneModel not attached to this Renderer");
        }
        const rendererModel = this.#rendererModels[sceneModel.id];
        delete this.#rendererModels[sceneModel.id];
        this.#detachRendererViewObjects(rendererModel);
        sceneModel.rendererModel = null;
    }

    /**
     * @Inheritdoc
     */
    setImageDirty(viewIndex?: number): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): SDKError | void { // @ts-ignore
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    setPBREnabled(viewIndex: number, enabled: boolean): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    getSAOSupported(): boolean {
        return false;
    }

    /**
     * @Inheritdoc
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    clear(viewIndex: number): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    };

    /**
     * @Inheritdoc
     */
    needsRebuild(viewIndex?: number): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    needsRender(viewIndex?: number): SDKError | boolean {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
        return false;
    }

    /**
     * @Inheritdoc
     */
    render(viewIndex: number, params: {
        force?: boolean;
    }): SDKError | void {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
    }

    /**
     * @Inheritdoc
     */
    pickViewObject(viewIndex: number, params: {}): ViewObject | null | SDKError {
        if (!this.#view) {
            return new SDKError("No View is currently attached to this Renderer");
        }
        if (viewIndex !== 0) {
            return new SDKError(`No View with the given handle (${viewIndex}) is currently attached to this Renderer`);
        }
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