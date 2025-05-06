import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOLinesBatchingDrawColorRenderer} from "./VBOLinesBatchingDrawColorRenderer";
import {VBOLinesBatchingPickMeshRenderer} from "./VBOLinesBatchingPickMeshRenderer";
import {VBOLinesBatchingSilhouetteRenderer} from "./VBOLinesBatchingSilhouetteRenderer";
import type {VBORenderer} from "../../../VBORenderer";
import type {WebGLRenderer} from "../../../../WebGLRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

  createDrawColorRenderer(): VBORenderer {
    return new VBOLinesBatchingDrawColorRenderer(this.renderContext);
  }

  createPickMeshRenderer(): VBORenderer {
    return new VBOLinesBatchingPickMeshRenderer(this.renderContext);
  }

  createSilhouetteRenderer(): VBORenderer {
    return new VBOLinesBatchingSilhouetteRenderer(this.renderContext);
  }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
  return new RendererFactory(webglRenderer);
}));
