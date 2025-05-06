import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import type {VBOBatchingRenderer} from "../../VBOBatchingRenderer";
import {VBOPointsBatchingDrawColorRenderer} from "./VBOPointsBatchingDrawColorRenderer";
import {VBOPointsBatchingPickMeshRenderer} from "./VBOPointsBatchingPickMeshRenderer";
import {VBOPointsBatchingSilhouetteRenderer} from "./VBOPointsBatchingSilhouetteRenderer";
import type {VBORenderer} from "../../../VBORenderer";
import type {WebGLRenderer} from "../../../../WebGLRenderer";


/**
 * @private
 */
class RendererFactory extends VBORendererSet {

  createDrawColorRenderer(): VBOBatchingRenderer {
    return new VBOPointsBatchingDrawColorRenderer(this.renderContext);
  }

  createPickMeshRenderer(): VBORenderer {
    return new VBOPointsBatchingPickMeshRenderer(this.renderContext);
  }

  createSilhouetteRenderer(): VBORenderer {
    return new VBOPointsBatchingSilhouetteRenderer(this.renderContext);
  }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
  return new RendererFactory(webglRenderer);
}));
