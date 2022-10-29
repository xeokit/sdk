import {View} from "../../../../../../viewer";

import {TrianglesInstancingColorRenderer} from "./renderers/TrianglesInstancingColorRenderer";
import {TrianglesInstancingFlatColorRenderer} from "./renderers/TrianglesInstancingFlatColorRenderer";
import {TrianglesInstancingSilhouetteRenderer} from "./renderers/TrianglesInstancingSilhouetteRenderer";
import {TrianglesInstancingEdgesRenderer} from "./renderers/TrianglesInstancingEdgesRenderer";
import {TrianglesInstancingEdgesColorRenderer} from "./renderers/TrianglesInstancingEdgesColorRenderer";
import {TrianglesInstancingPickMeshRenderer} from "./renderers/TrianglesInstancingPickMeshRenderer";
import {TrianglesInstancingPickDepthRenderer} from "./renderers/TrianglesInstancingPickDepthRenderer";
import {TrianglesInstancingPickNormalsRenderer} from "./renderers/TrianglesInstancingPickNormalsRenderer";
import {TrianglesInstancingOcclusionRenderer} from "./renderers/TrianglesInstancingOcclusionRenderer";
import {TrianglesInstancingDepthRenderer} from "./renderers/TrianglesInstancingDepthRenderer";
import {TrianglesInstancingNormalsRenderer} from "./renderers/TrianglesInstancingNormalsRenderer";
// import {TrianglesInstancingPBRRenderer} from "./renderers/TrianglesInstancingPBRRenderer";
import {TrianglesInstancingPickNormalsFlatRenderer} from "./renderers/TrianglesInstancingPickNormalsFlatRenderer";
import {TrianglesInstancingColorTextureRenderer} from "./renderers/TrianglesInstancingColorTextureRenderer";


class TrianglesInstancingRenderers {
    #view: View;

    #fastColorRenderer: TrianglesInstancingColorRenderer;
    #colorRendererWithSAO: TrianglesInstancingColorRenderer;
    #flatColorRenderer: TrianglesInstancingFlatColorRenderer;
    #flatColorRendererWithSAO: TrianglesInstancingFlatColorRenderer;
    #colorTextureRenderer: TrianglesInstancingColorTextureRenderer;
    #colorTextureRendererWithSAO: TrianglesInstancingColorTextureRenderer;
    //  #pbrRenderer: TrianglesInstancingPBRRenderer;
    //#pbrRendererWithSAO: TrianglesInstancingPBRRenderer;
    #depthRenderer: TrianglesInstancingDepthRenderer;
    #normalsRenderer: TrianglesInstancingNormalsRenderer;
    #silhouetteRenderer: TrianglesInstancingSilhouetteRenderer;
    #edgesRenderer: TrianglesInstancingEdgesRenderer;
    #edgesColorRenderer: TrianglesInstancingEdgesColorRenderer;
    #pickMeshRenderer: TrianglesInstancingPickMeshRenderer;
    #pickDepthRenderer: TrianglesInstancingPickDepthRenderer;
    #pickNormalsRenderer: TrianglesInstancingPickNormalsRenderer;
    #pickNormalsFlatRenderer: TrianglesInstancingPickNormalsFlatRenderer;
    #occlusionRenderer: TrianglesInstancingOcclusionRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    compile() {
        if (this.#fastColorRenderer && (!this.#fastColorRenderer.getValid())) {
            this.#fastColorRenderer.destroy();
            this.#fastColorRenderer = null;
        }
        if (this.#colorRendererWithSAO && (!this.#colorRendererWithSAO.getValid())) {
            this.#colorRendererWithSAO.destroy();
            this.#colorRendererWithSAO = null;
        }
        if (this.#flatColorRenderer && (!this.#flatColorRenderer.getValid())) {
            this.#flatColorRenderer.destroy();
            this.#flatColorRenderer = null;
        }
        if (this.#flatColorRendererWithSAO && (!this.#flatColorRendererWithSAO.getValid())) {
            this.#flatColorRendererWithSAO.destroy();
            this.#flatColorRendererWithSAO = null;
        }
        // if (this.#pbrRenderer && (!this.#pbrRenderer.getValid())) {
        //     this.#pbrRenderer.destroy();
        //     this.#pbrRenderer = null;
        // }
        // if (this.#pbrRendererWithSAO && (!this.#pbrRendererWithSAO.getValid())) {
        //     this.#pbrRendererWithSAO.destroy();
        //     this.#pbrRendererWithSAO = null;
        // }
        if (this.#colorTextureRenderer && (!this.#colorTextureRenderer.getValid())) {
            this.#colorTextureRenderer.destroy();
            this.#colorTextureRenderer = null;
        }
        if (this.#colorTextureRendererWithSAO && (!this.#colorTextureRendererWithSAO.getValid())) {
            this.#colorTextureRendererWithSAO.destroy();
            this.#colorTextureRendererWithSAO = null;
        }
        if (this.#depthRenderer && (!this.#depthRenderer.getValid())) {
            this.#depthRenderer.destroy();
            this.#depthRenderer = null;
        }
        if (this.#normalsRenderer && (!this.#normalsRenderer.getValid())) {
            this.#normalsRenderer.destroy();
            this.#normalsRenderer = null;
        }
        if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
            this.#silhouetteRenderer.destroy();
            this.#silhouetteRenderer = null;
        }
        if (this.#edgesRenderer && (!this.#edgesRenderer.getValid())) {
            this.#edgesRenderer.destroy();
            this.#edgesRenderer = null;
        }
        if (this.#edgesColorRenderer && (!this.#edgesColorRenderer.getValid())) {
            this.#edgesColorRenderer.destroy();
            this.#edgesColorRenderer = null;
        }
        if (this.#pickMeshRenderer && (!this.#pickMeshRenderer.getValid())) {
            this.#pickMeshRenderer.destroy();
            this.#pickMeshRenderer = null;
        }
        if (this.#pickDepthRenderer && (!this.#pickDepthRenderer.getValid())) {
            this.#pickDepthRenderer.destroy();
            this.#pickDepthRenderer = null;
        }
        if (this.#pickNormalsRenderer && this.#pickNormalsRenderer.getValid() === false) {
            this.#pickNormalsRenderer.destroy();
            this.#pickNormalsRenderer = null;
        }
        if (this.#pickNormalsFlatRenderer && (!this.#pickNormalsFlatRenderer.getValid())) {
            this.#pickNormalsFlatRenderer.destroy();
            this.#pickNormalsFlatRenderer = null;
        }
        if (this.#occlusionRenderer && this.#occlusionRenderer.getValid() === false) {
            this.#occlusionRenderer.destroy();
            this.#occlusionRenderer = null;
        }
        // if (this.#shadowRenderer && (!this.#shadowRenderer.getValid())) {
        //     this.#shadowRenderer.destroy();
        //     this.#shadowRenderer = null;
        // }
    }

    get fastColorRenderer() {
        if (!this.#fastColorRenderer) {
            this.#fastColorRenderer = new TrianglesInstancingColorRenderer(this.#view, false);
        }
        return this.#fastColorRenderer;
    }

    get colorRendererWithSAO() {
        if (!this.#colorRendererWithSAO) {
            this.#colorRendererWithSAO = new TrianglesInstancingColorRenderer(this.#view, true);
        }
        return this.#colorRendererWithSAO;
    }

    get flatColorRenderer() {
        if (!this.#flatColorRenderer) {
            this.#flatColorRenderer = new TrianglesInstancingFlatColorRenderer(this.#view, false);
        }
        return this.#flatColorRenderer;
    }

    get flatColorRendererWithSAO() {
        if (!this.#flatColorRendererWithSAO) {
            this.#flatColorRendererWithSAO = new TrianglesInstancingFlatColorRenderer(this.#view, true);
        }
        return this.#flatColorRendererWithSAO;
    }

    get pbrRenderer(): any {
        // if (!this.#pbrRenderer) {
        //     this.#pbrRenderer = new TrianglesInstancingPBRRenderer(this.#view, false);
        // }
        // return this.#pbrRenderer;
        return null;
    }

    get pbrRendererWithSAO(): any {
        // if (!this.#pbrRendererWithSAO) {
        //     this.#pbrRendererWithSAO = new TrianglesInstancingPBRRenderer(this.#view, true);
        // }
        // return this.#pbrRendererWithSAO;
        return null;
    }

    get colorTextureRenderer() {
        if (!this.#colorTextureRenderer) {
            this.#colorTextureRenderer = new TrianglesInstancingColorTextureRenderer(this.#view, false);
        }
        return this.#colorTextureRenderer;
    }

    get colorTextureRendererWithSAO() {
        if (!this.#colorTextureRendererWithSAO) {
            this.#colorTextureRendererWithSAO = new TrianglesInstancingColorTextureRenderer(this.#view, true);
        }
        return this.#colorTextureRendererWithSAO;
    }

    get silhouetteRenderer() {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new TrianglesInstancingSilhouetteRenderer(this.#view);
        }
        return this.#silhouetteRenderer;
    }

    get depthRenderer() {
        if (!this.#depthRenderer) {
            this.#depthRenderer = new TrianglesInstancingDepthRenderer(this.#view);
        }
        return this.#depthRenderer;
    }

    get normalsRenderer() {
        if (!this.#normalsRenderer) {
            this.#normalsRenderer = new TrianglesInstancingNormalsRenderer(this.#view);
        }
        return this.#normalsRenderer;
    }

    get edgesRenderer() {
        if (!this.#edgesRenderer) {
            this.#edgesRenderer = new TrianglesInstancingEdgesRenderer(this.#view);
        }
        return this.#edgesRenderer;
    }

    get edgesColorRenderer() {
        if (!this.#edgesColorRenderer) {
            this.#edgesColorRenderer = new TrianglesInstancingEdgesColorRenderer(this.#view);
        }
        return this.#edgesColorRenderer;
    }

    get pickMeshRenderer() {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer = new TrianglesInstancingPickMeshRenderer(this.#view);
        }
        return this.#pickMeshRenderer;
    }

    get pickNormalsRenderer() {
        if (!this.#pickNormalsRenderer) {
            this.#pickNormalsRenderer = new TrianglesInstancingPickNormalsRenderer(this.#view);
        }
        return this.#pickNormalsRenderer;
    }

    get pickNormalsFlatRenderer() {
        if (!this.#pickNormalsFlatRenderer) {
            this.#pickNormalsFlatRenderer = new TrianglesInstancingPickNormalsFlatRenderer(this.#view);
        }
        return this.#pickNormalsFlatRenderer;
    }

    get pickDepthRenderer() {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = new TrianglesInstancingPickDepthRenderer(this.#view);
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer() {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = new TrianglesInstancingOcclusionRenderer(this.#view);
        }
        return this.#occlusionRenderer;
    }

    destroy() {
        if (this.#fastColorRenderer) {
            this.#fastColorRenderer.destroy();
        }
        if (this.#colorRendererWithSAO) {
            this.#colorRendererWithSAO.destroy();
        }
        if (this.#flatColorRenderer) {
            this.#flatColorRenderer.destroy();
        }
        if (this.#flatColorRendererWithSAO) {
            this.#flatColorRendererWithSAO.destroy();
        }
        // if (this.#pbrRenderer) {
        //     this.#pbrRenderer.destroy();
        // }
        // if (this.#pbrRendererWithSAO) {
        //     this.#pbrRendererWithSAO.destroy();
        // }
        if (this.#colorTextureRenderer) {
            this.#colorTextureRenderer.destroy();
        }
        if (this.#colorTextureRendererWithSAO) {
            this.#colorTextureRendererWithSAO.destroy();
        }
        if (this.#depthRenderer) {
            this.#depthRenderer.destroy();
        }
        if (this.#normalsRenderer) {
            this.#normalsRenderer.destroy();
        }
        if (this.#silhouetteRenderer) {
            this.#silhouetteRenderer.destroy();
        }
        if (this.#edgesRenderer) {
            this.#edgesRenderer.destroy();
        }
        if (this.#edgesColorRenderer) {
            this.#edgesColorRenderer.destroy();
        }
        if (this.#pickMeshRenderer) {
            this.#pickMeshRenderer.destroy();
        }
        if (this.#pickDepthRenderer) {
            this.#pickDepthRenderer.destroy();
        }
        if (this.#pickNormalsRenderer) {
            this.#pickNormalsRenderer.destroy();
        }
        if (this.#pickNormalsFlatRenderer) {
            this.#pickNormalsFlatRenderer.destroy();
        }
        if (this.#occlusionRenderer) {
            this.#occlusionRenderer.destroy();
        }
        // if (this.#shadowRenderer) {
        //     this.#shadowRenderer.destroy();
        // }
    }
}

const cachedRenderers: { [key: string]: TrianglesInstancingRenderers } = {};

/**
 * @private
 */
function getTrianglesInstancingRenderers(view: View): TrianglesInstancingRenderers {
    const viewId = view.id;
    let renderers = cachedRenderers[viewId];
    if (!renderers) {
        renderers = new TrianglesInstancingRenderers(view);
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

export {getTrianglesInstancingRenderers};