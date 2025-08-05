import type {RenderContext} from "../RenderContext";
import type {LayerRenderer} from "./LayerRenderer";
import type {WebGLRenderer} from "../WebGLRenderer";

/**
 * @private
 */
export class LayerRendererSet {

  renderContext: RenderContext;

  #colorRenderer: LayerRenderer;
  #colorSAORenderer: LayerRenderer;
  #drawDepthRenderer: LayerRenderer;
  #silhouetteRenderer: LayerRenderer;
  #pickMeshRenderer: LayerRenderer;
  #pickDepthRenderer: LayerRenderer;
  #occlusionRenderer: LayerRenderer;
  #snapInitRenderer: LayerRenderer;
  #snapRenderer: LayerRenderer;
  #edgesColorRenderer: LayerRenderer;
  #edgesSilhouetteRenderer: LayerRenderer;

  constructor(renderContext: RenderContext) {
    this.renderContext = renderContext;
  }

  _compile() {
    if (this.#colorRenderer && (!this.#colorRenderer.getValid())) {
      this.#colorRenderer.destroy();
      this.#colorRenderer = null;
    }
    if (this.#colorSAORenderer && (!this.#colorSAORenderer.getValid())) {
      this.#colorSAORenderer.destroy();
      this.#colorSAORenderer = null;
    }
    if (this.#drawDepthRenderer && (!this.#drawDepthRenderer.getValid())) {
      this.#drawDepthRenderer.destroy();
      this.#drawDepthRenderer = null;
    }
    if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
      this.#silhouetteRenderer.destroy();
      this.#silhouetteRenderer = null;
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

  get colorRenderer(): LayerRenderer {
    if (!this.#colorRenderer) {
      this.#colorRenderer = this.createDrawColorRenderer();
    }
    return this.#colorRenderer;
  }

  get colorSAORenderer(): LayerRenderer {
    if (!this.#colorSAORenderer) {
      this.#colorSAORenderer = this.createDrawColorSAORenderer();
    }
    return this.#colorSAORenderer;
  }

  get drawDepthRenderer(): LayerRenderer {
    if (!this.#colorRenderer) {
      this.#colorRenderer = this.createDrawDepthRenderer();
    }
    return this.#colorRenderer;
  }

  get silhouetteRenderer(): LayerRenderer {
    if (!this.#silhouetteRenderer) {
      this.#silhouetteRenderer = this.createSilhouetteRenderer();
    }
    return this.#silhouetteRenderer;
  }

  get edgesColorRenderer(): LayerRenderer {
    if (!this.#edgesColorRenderer) {
      this.#edgesColorRenderer = this.createEdgesColorRenderer();
    }
    return this.#edgesColorRenderer;
  }

  get edgesSilhouetteRenderer(): LayerRenderer {
    if (!this.#edgesSilhouetteRenderer) {
      this.#edgesSilhouetteRenderer = this.createEdgesSilhouetteRenderer();
    }
    return this.#edgesSilhouetteRenderer;
  }

  get pickMeshRenderer(): LayerRenderer {
    if (!this.#pickMeshRenderer) {
      this.#pickMeshRenderer = this.createPickMeshRenderer();
    }
    return this.#pickMeshRenderer;
  }

  get pickDepthRenderer(): LayerRenderer {
    if (!this.#pickDepthRenderer) {
      this.#pickDepthRenderer = this.createPickDepthRenderer();
    }
    return this.#pickDepthRenderer;
  }

  get occlusionRenderer(): LayerRenderer {
    if (!this.#occlusionRenderer) {
      this.#occlusionRenderer = this.createOcclusionRenderer();
    }
    return this.#occlusionRenderer;
  }

  get snapInitRenderer(): LayerRenderer {
    if (!this.#snapInitRenderer) {
      this.#snapInitRenderer = this.createSnapInitRenderer();
    }
    return this.#snapInitRenderer;
  }

  get snapRenderer(): LayerRenderer {
    if (!this.#snapRenderer) {
      this.#snapInitRenderer = this.createSnapRenderer();
    }
    return this.#snapRenderer;
  }

  protected createDrawColorRenderer(): LayerRenderer {
    return null;
  }

  protected createDrawColorSAORenderer(): LayerRenderer {
    return null;
  }

  protected createDrawDepthRenderer(): LayerRenderer {
    return null;
  }

  protected createSilhouetteRenderer(): LayerRenderer {
    return null;
  }

  protected createEdgesColorRenderer(): LayerRenderer {
    return null;
  }

  protected createEdgesSilhouetteRenderer(): LayerRenderer {
    return null;
  }

  protected createPickMeshRenderer(): LayerRenderer {
    return null;
  }

  protected createPickDepthRenderer(): LayerRenderer {
    return null;
  }

  protected createOcclusionRenderer(): LayerRenderer {
    return null;
  }

  protected createSnapInitRenderer(): LayerRenderer {
    return null;
  }

  protected createSnapRenderer(): LayerRenderer {
    return null;
  }

  _destroy() {
    if (this.#colorRenderer) {
      this.#colorRenderer.destroy();
    }
    if (this.#colorSAORenderer) {
      this.#colorSAORenderer.destroy();
    }
    if (this.#drawDepthRenderer) {
      this.#drawDepthRenderer.destroy();
    }
    if (this.#silhouetteRenderer) {
      this.#silhouetteRenderer.destroy();
    }
    if (this.#edgesColorRenderer) {
      this.#edgesColorRenderer.destroy();
    }
    if (this.#edgesSilhouetteRenderer) {
      this.#edgesSilhouetteRenderer.destroy();
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

  #createRendererSet: (webglRenderer: WebGLRenderer) => LayerRendererSet;

  constructor(createRendererSet: (webglRenderer) => LayerRendererSet) {
    this.#rendererSets = {};
    this.#createRendererSet = createRendererSet;
  }

  getRenderers(webglRenderer: WebGLRenderer): LayerRendererSet {
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
