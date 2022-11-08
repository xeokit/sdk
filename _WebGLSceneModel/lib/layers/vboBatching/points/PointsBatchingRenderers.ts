import {View} from "../../../../../src/viewer/view/View";
import {PointsBatchingOcclusionRenderer} from "./renderers/PointsBatchingOcclusionRenderer";
import {PointsBatchingColorRenderer} from "./renderers/PointsBatchingColorRenderer";
import {PointsBatchingSilhouetteRenderer} from "./renderers/PointsBatchingSilhouetteRenderer";
import {PointsBatchingPickMeshRenderer} from "./renderers/PointsBatchingPickMeshRenderer";
import {PointsBatchingPickDepthRenderer} from "./renderers/PointsBatchingPickDepthRenderer";

/**
 * @private
 */
class PointsBatchingRenderers {

    #view: View;

    #fastColorRenderer: PointsBatchingColorRenderer;
    #silhouetteRenderer: PointsBatchingSilhouetteRenderer;
    #pickMeshRenderer: PointsBatchingPickMeshRenderer;
    #pickDepthRenderer: PointsBatchingPickDepthRenderer;
    #occlusionRenderer: PointsBatchingOcclusionRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    get fastColorRenderer(): PointsBatchingColorRenderer {
        if (!this.#fastColorRenderer) {
            this.#fastColorRenderer = new PointsBatchingColorRenderer(this.#view);
        }
        return this.#fastColorRenderer;
    }

    get silhouetteRenderer(): PointsBatchingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new PointsBatchingSilhouetteRenderer(this.#view);
        }
        return this.#silhouetteRenderer;
    }

    get pickMeshRenderer(): PointsBatchingPickMeshRenderer {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer = new PointsBatchingPickMeshRenderer(this.#view);
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer(): PointsBatchingPickDepthRenderer {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = new PointsBatchingPickDepthRenderer(this.#view);
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer(): PointsBatchingOcclusionRenderer {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = new PointsBatchingOcclusionRenderer(this.#view);
        }
        return this.#occlusionRenderer;
    }

    compile() {
        if (this.#fastColorRenderer && (!this.#fastColorRenderer.getValid())) {
            this.#fastColorRenderer.destroy();
            this.#fastColorRenderer = null;
        }
        if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
            this.#silhouetteRenderer.destroy();
            this.#silhouetteRenderer = null;
        }
        if (this.#pickMeshRenderer && (!this.#pickMeshRenderer.getValid())) {
            this.#pickMeshRenderer.destroy();
            this.#pickMeshRenderer = null;
        }
        if (this.#pickDepthRenderer && (!this.#pickDepthRenderer.getValid())) {
            this.#pickDepthRenderer.destroy();
            this.#pickDepthRenderer = null;
        }
        if (this.#occlusionRenderer && this.#occlusionRenderer.getValid() === false) {
            this.#occlusionRenderer.destroy();
            this.#occlusionRenderer = null;
        }
    }

    destroy() {
        if (this.#fastColorRenderer) {
            this.#fastColorRenderer.destroy();
        }
        if (this.#silhouetteRenderer) {
            this.#silhouetteRenderer.destroy();
        }
        if (this.#pickMeshRenderer) {
            this.#pickMeshRenderer.destroy();
        }
        if (this.#pickDepthRenderer) {
            this.#pickDepthRenderer.destroy();
        }
        if (this.#occlusionRenderer) {
            this.#occlusionRenderer.destroy();
        }
    }
}

const cachedRenderers: { [key: string]: PointsBatchingRenderers } = {};

/**
 * @private
 */
function getPointsBatchingRenderers(view: View): PointsBatchingRenderers {
    const viewId = view.id;
    let renderers = cachedRenderers[viewId];
    if (!renderers) {
        renderers = new PointsBatchingRenderers(view);
        cachedRenderers[viewId] = renderers;
        renderers.compile();
        view.events.on("compile", () => {
            renderers.compile();
        });
        view.events.on("destroyed", () => {
            delete cachedRenderers[viewId];
            renderers.destroy();
        });
    }
    return renderers;
}

export {getPointsBatchingRenderers};