import {RenderContext} from "../../RenderContext";
import {VBOInstancingRenderer} from "./VBOInstancingRenderer";
import {RenderStats} from "../../RenderStats";
import {WebGLRenderer} from "../../WebGLRenderer";

/**
 * @private
 */
export class VBOInstancingRendererSet {

    renderContext: RenderContext;
    renderStats: RenderStats;

    #colorRenderer: VBOInstancingRenderer;
    #silhouetteRenderer: VBOInstancingRenderer;
    #pickMeshRenderer: VBOInstancingRenderer;
    #pickDepthRenderer: VBOInstancingRenderer;
    #occlusionRenderer: VBOInstancingRenderer;
    #snapInitRenderer: VBOInstancingRenderer;
    #snapRenderer: VBOInstancingRenderer;
    edgesColorRenderer: VBOInstancingRenderer;
    edgesSilhouetteRenderer: VBOInstancingRenderer;
    depthRenderer: VBOInstancingRenderer;
    normalsRenderer: VBOInstancingRenderer;

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

    get colorRenderer(): VBOInstancingRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = this.createColorRenderer();
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): VBOInstancingRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = this.createSilhouetteRenderer();
        }
        return this.#silhouetteRenderer;
    }

    get pickMeshRenderer(): VBOInstancingRenderer {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer  = this.createPickMeshRenderer();
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer(): VBOInstancingRenderer {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = this.createPickDepthRenderer();
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer(): VBOInstancingRenderer {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = this.createOcclusionRenderer();
        }
        return this.#occlusionRenderer;
    }

    get snapInitRenderer(): VBOInstancingRenderer {
        if (!this.#snapInitRenderer) {
            this.#snapInitRenderer = this.createSnapInitRenderer();
        }
        return this.#snapInitRenderer;
    }

    get snapRenderer(): VBOInstancingRenderer {
        if (!this.#snapRenderer) {
            this.#snapInitRenderer = this.createSnapRenderer();
        }
        return this.#snapRenderer;
    }

    protected createColorRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createSilhouetteRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createPickMeshRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createPickDepthRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createOcclusionRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createSnapInitRenderer(): VBOInstancingRenderer {
        return null;
    }

    protected createSnapRenderer(): VBOInstancingRenderer {
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

    #createRendererSet: (webglRenderer: WebGLRenderer) => VBOInstancingRendererSet;

    constructor(createRendererSet:(webglRenderer)=> VBOInstancingRendererSet) {
        this.#rendererSets = {};
        this.#createRendererSet = createRendererSet;
    }

    getRenderers(webglRenderer: WebGLRenderer): VBOInstancingRendererSet {
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
