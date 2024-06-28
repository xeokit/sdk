import {RenderContext} from "../../RenderContext";
import {VBOBatchingRenderer} from "./VBOBatchingRenderer";
import {RenderStats} from "../../RenderStats";
import {WebGLRenderer} from "../../WebGLRenderer";

/**
 * @private
 */
export class VBOBatchingRendererSet {

    renderContext: RenderContext;
    renderStats: RenderStats;

    #colorRenderer: VBOBatchingRenderer;
    #silhouetteRenderer: VBOBatchingRenderer;
    #pickMeshRenderer: VBOBatchingRenderer;
    #pickDepthRenderer: VBOBatchingRenderer;
    #occlusionRenderer: VBOBatchingRenderer;
    #snapInitRenderer: VBOBatchingRenderer;
    #snapRenderer: VBOBatchingRenderer;
    edgesColorRenderer: VBOBatchingRenderer;
    edgesSilhouetteRenderer: VBOBatchingRenderer;
    depthRenderer: VBOBatchingRenderer;
    normalsRenderer: VBOBatchingRenderer;

    constructor(webglRenderer: WebGLRenderer) {
        this.renderContext = webglRenderer.renderContext;
        this.renderStats = webglRenderer.renderStats;
    }

    _compile() {
        if (this.#colorRenderer && (!this.#colorRenderer.getValid())) {
            this.#colorRenderer.destroy();
            this.#colorRenderer = null;
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
        if (this.#snapInitRenderer && (!this.#snapInitRenderer.getValid())) {
            this.#snapInitRenderer.destroy();
            this.#snapInitRenderer = null;
        }
        if (this.#snapRenderer && (!this.#snapRenderer.getValid())) {
            this.#snapRenderer.destroy();
            this.#snapRenderer = null;
        }
    }

    _eagerCreate() {

    }

    get colorRenderer(): VBOBatchingRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = this.createColorRenderer();
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): VBOBatchingRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = this.createSilhouetteRenderer();
        }
        return this.#silhouetteRenderer;
    }

    get pickMeshRenderer(): VBOBatchingRenderer {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer  = this.createPickMeshRenderer();
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer(): VBOBatchingRenderer {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = this.createPickDepthRenderer();
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer(): VBOBatchingRenderer {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = this.createOcclusionRenderer();
        }
        return this.#occlusionRenderer;
    }

    get snapInitRenderer(): VBOBatchingRenderer {
        if (!this.#snapInitRenderer) {
            this.#snapInitRenderer = this.createSnapInitRenderer();
        }
        return this.#snapInitRenderer;
    }

    get snapRenderer(): VBOBatchingRenderer {
        if (!this.#snapRenderer) {
            this.#snapInitRenderer = this.createSnapRenderer();
        }
        return this.#snapRenderer;
    }

    protected createColorRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createSilhouetteRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createPickMeshRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createPickDepthRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createOcclusionRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createSnapInitRenderer(): VBOBatchingRenderer {
        return null;
    }

    protected createSnapRenderer(): VBOBatchingRenderer {
        return null;
    }

    _destroy() {
        if (this.#colorRenderer) {
            this.#colorRenderer.destroy();
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
        if (this.#snapInitRenderer) {
            this.#snapInitRenderer.destroy();
        }
        if (this.#snapRenderer) {
            this.#snapRenderer.destroy();
        }
    }
}

/**
 * @private
 */
export class RendererSetFactory {

    #rendererSets: {};

    #createRendererSet: (webglRenderer: WebGLRenderer) => VBOBatchingRendererSet;

    constructor(createRendererSet:(webglRenderer)=> VBOBatchingRendererSet) {
        this.#rendererSets = {};
        this.#createRendererSet = createRendererSet;
    }

    getRenderers(webglRenderer: WebGLRenderer): VBOBatchingRendererSet {
        const viewerId = webglRenderer.viewer.id;
        let rendererSet = this.#rendererSets[viewerId];
        if (!rendererSet) {
            rendererSet = this.#createRendererSet(webglRenderer);
            this.#rendererSets[viewerId] = rendererSet;
            rendererSet._compile();
            rendererSet._eagerCreate();
            webglRenderer.onCompiled.sub(() => {
                rendererSet._compile();
                rendererSet._eagerCreate();
            });
            webglRenderer.onDestroyed.sub(() => {
                delete this.#rendererSets[viewerId];
                rendererSet._destroy();
            });
        }
        return rendererSet;
    }
}
