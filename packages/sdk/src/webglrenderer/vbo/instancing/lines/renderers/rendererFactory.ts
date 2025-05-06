import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOLinesInstancingDrawColorRenderer} from "./VBOLinesInstancingDrawColorRenderer";
import {VBOLinesInstancingPickMeshRenderer} from "./VBOLinesInstancingPickMeshRenderer";
import {VBOLinesInstancingSilhouetteRenderer} from "./VBOLinesInstancingSilhouetteRenderer";
import type {VBORenderer} from "../../../VBORenderer";
import type {WebGLRenderer} from "../../../../WebGLRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

  createDrawColorRenderer(): VBORenderer {
    return new VBOLinesInstancingDrawColorRenderer(this.renderContext);
  }

  createPickMeshRenderer(): VBORenderer {
    return new VBOLinesInstancingPickMeshRenderer(this.renderContext);
  }

  createSilhouetteRenderer(): VBORenderer {
    return new VBOLinesInstancingSilhouetteRenderer(this.renderContext);
  }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
  return new RendererFactory(webglRenderer);
}));
