import {PointsInstancingColorRenderer} from "./renderers/PointsInstancingColorRenderer";
import {PointsInstancingSilhouetteRenderer} from "./renderers/PointsInstancingSilhouetteRenderer";
import {PointsInstancingPickMeshRenderer} from "./renderers/PointsInstancingPickMeshRenderer";
import {PointsInstancingPickDepthRenderer} from "./renderers/PointsInstancingPickDepthRenderer";
import {PointsInstancingOcclusionRenderer} from "./renderers/PointsInstancingOcclusionRenderer";
import {PointsInstancingDepthRenderer} from "./renderers/PointsInstancingDepthRenderer";
import {View} from "../../../../../../../view/View";

/**
 * @private
 */
export class PointsInstancingRenderers {

    #view: View;
    #colorRenderer: PointsInstancingColorRenderer;
    #silhouetteRenderer: PointsInstancingSilhouetteRenderer;
    #depthRenderer: PointsInstancingDepthRenderer;
    #pickMeshRenderer: PointsInstancingPickMeshRenderer;
    #pickDepthRenderer: PointsInstancingPickDepthRenderer;
    #occlusionRenderer: PointsInstancingOcclusionRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    compile() {
        if (this.#colorRenderer && (!this.#colorRenderer.getValid())) {
            this.#colorRenderer.destroy();
            this.#colorRenderer = null;
        }
        if (this.#depthRenderer && (!this.#depthRenderer.getValid())) {
            this.#depthRenderer.destroy();
            this.#depthRenderer = null;
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

    get colorRenderer(): PointsInstancingColorRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = new PointsInstancingColorRenderer(this.#view);
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): PointsInstancingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new PointsInstancingSilhouetteRenderer(this.#view);
        }
        return this.#silhouetteRenderer;
    }

    get depthRenderer(): PointsInstancingDepthRenderer {
        if (!this.#depthRenderer) {
            this.#depthRenderer = new PointsInstancingDepthRenderer(this.#view);
        }
        return this.#depthRenderer;
    }

    get pickMeshRenderer(): PointsInstancingPickMeshRenderer {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer = new PointsInstancingPickMeshRenderer(this.#view);
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer() {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = new PointsInstancingPickDepthRenderer(this.#view);
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer() {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = new PointsInstancingOcclusionRenderer(this.#view);
        }
        return this.#occlusionRenderer;
    }

    destroy() {
        if (this.#colorRenderer) {
            this.#colorRenderer.destroy();
        }
        if (this.#depthRenderer) {
            this.#depthRenderer.destroy();
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

const cachedRenderers: { [key: string]: PointsInstancingRenderers } = {};

/**
 * @private
 */
export function getPointsInstancingRenderers(view: View): PointsInstancingRenderers {
    const viewId = view.id;
    let InstancingRenderers = cachedRenderers[viewId];
    if (!InstancingRenderers) {
        InstancingRenderers = new PointsInstancingRenderers(view);
        cachedRenderers[viewId] = InstancingRenderers;
        InstancingRenderers.compile();
        view.events.on("compile", () => {
            InstancingRenderers.compile();
        });
        view.events.on("destroyed", () => {
            delete cachedRenderers[viewId];
            InstancingRenderers.destroy();
        });
    }
    return InstancingRenderers;
}