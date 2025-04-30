import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
import type { VBORenderer } from "../../../VBORenderer";
import { VBOTrianglesInstancingDrawColorRenderer } from "./VBOTrianglesInstancingDrawColorRenderer";
import { VBOTrianglesInstancingDrawColorSAORenderer } from "./VBOTrianglesInstancingDrawColorSAORenderer";
import { VBOTrianglesInstancingDrawDepthRenderer } from "./VBOTrianglesInstancingDrawDepthRenderer";
import { VBOTrianglesInstancingEdgesDrawRenderer } from "./VBOTrianglesInstancingEdgesDrawRenderer";
import { VBOTrianglesInstancingEdgesSilhouetteRenderer } from "./VBOTrianglesInstancingEdgesSilhouetteRenderer";
import { VBOTrianglesInstancingPickMeshRenderer } from "./VBOTrianglesInstancingPickMeshRenderer";
import { VBOTrianglesInstancingSilhouetteRenderer } from "./VBOTrianglesInstancingSilhouetteRenderer";
import type { WebGLRenderer } from "../../../../WebGLRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

  createDrawColorRenderer(): VBORenderer {
    return new VBOTrianglesInstancingDrawColorRenderer(this.renderContext);
  }

  createDrawColorSAORenderer(): VBORenderer {
    return new VBOTrianglesInstancingDrawColorSAORenderer(this.renderContext);
  }

  createDrawDepthRenderer(): VBORenderer {
    return new VBOTrianglesInstancingDrawDepthRenderer(this.renderContext);
  }

  createSilhouetteRenderer(): VBORenderer {
    return new VBOTrianglesInstancingSilhouetteRenderer(this.renderContext);
  }

  createPickMeshRenderer(): VBORenderer {
    return new VBOTrianglesInstancingPickMeshRenderer(this.renderContext);
  }

  createEdgesColorRenderer(): VBORenderer {
    return new VBOTrianglesInstancingEdgesDrawRenderer(this.renderContext);
  }

  createEdgesSilhouetteRenderer(): VBORenderer {
    return new VBOTrianglesInstancingEdgesSilhouetteRenderer(this.renderContext);
  }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
  return new RendererFactory(webglRenderer);
}));
