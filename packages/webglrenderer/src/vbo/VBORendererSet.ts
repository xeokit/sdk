import {RenderContext} from "../RenderContext";
import {VBORenderer} from "./VBORenderer";
import {RenderStats} from "../RenderStats";
import {WebGLRenderer} from "../WebGLRenderer";

/**
 * @private
 */
export class VBORendererSet {

    renderContext: RenderContext;
    renderStats: RenderStats;

    #colorRenderer: VBORenderer;
    #silhouetteRenderer: VBORenderer;
    #pickMeshRenderer: VBORenderer;
    #pickDepthRenderer: VBORenderer;
    #occlusionRenderer: VBORenderer;
    #snapInitRenderer: VBORenderer;
    #snapRenderer: VBORenderer;
    edgesColorRenderer: VBORenderer;
    edgesSilhouetteRenderer: VBORenderer;
    depthRenderer: VBORenderer;
    normalsRenderer: VBORenderer;

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

    get colorRenderer(): VBORenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = this.createLambertRenderer();
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): VBORenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = this.createSilhouetteRenderer();
        }
        return this.#silhouetteRenderer;
    }

    get pickMeshRenderer(): VBORenderer {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer  = this.createPickMeshRenderer();
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer(): VBORenderer {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = this.createPickDepthRenderer();
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer(): VBORenderer {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = this.createOcclusionRenderer();
        }
        return this.#occlusionRenderer;
    }

    get snapInitRenderer(): VBORenderer {
        if (!this.#snapInitRenderer) {
            this.#snapInitRenderer = this.createSnapInitRenderer();
        }
        return this.#snapInitRenderer;
    }

    get snapRenderer(): VBORenderer {
        if (!this.#snapRenderer) {
            this.#snapInitRenderer = this.createSnapRenderer();
        }
        return this.#snapRenderer;
    }

    protected createLambertRenderer(): VBORenderer {
        return null;
    }

    protected createSilhouetteRenderer(): VBORenderer {
        return null;
    }

    protected createPickMeshRenderer(): VBORenderer {
        return null;
    }

    protected createPickDepthRenderer(): VBORenderer {
        return null;
    }

    protected createOcclusionRenderer(): VBORenderer {
        return null;
    }

    protected createSnapInitRenderer(): VBORenderer {
        return null;
    }

    protected createSnapRenderer(): VBORenderer {
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

    #createRendererSet: (webglRenderer: WebGLRenderer) => VBORendererSet;

    constructor(createRendererSet:(webglRenderer)=> VBORendererSet) {
        this.#rendererSets = {};
        this.#createRendererSet = createRendererSet;
    }

    getRenderers(webglRenderer: WebGLRenderer): VBORendererSet {
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
