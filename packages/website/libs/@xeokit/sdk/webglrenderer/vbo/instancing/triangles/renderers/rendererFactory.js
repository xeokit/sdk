import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
import { VBOTrianglesInstancingDrawColorRenderer } from "./VBOTrianglesInstancingDrawColorRenderer";
import { VBOTrianglesInstancingSilhouetteRenderer } from "./VBOTrianglesInstancingSilhouetteRenderer";
import { VBOTrianglesInstancingPickMeshRenderer } from "./VBOTrianglesInstancingPickMeshRenderer";
import { VBOTrianglesInstancingEdgesDrawRenderer } from "./VBOTrianglesInstancingEdgesDrawRenderer";
import { VBOTrianglesInstancingEdgesSilhouetteRenderer } from "./VBOTrianglesInstancingEdgesSilhouetteRenderer";
import { VBOTrianglesInstancingDrawDepthRenderer } from "./VBOTrianglesInstancingDrawDepthRenderer";
import { VBOTrianglesInstancingDrawColorSAORenderer } from "./VBOTrianglesInstancingDrawColorSAORenderer";
/**
 * @private
 */
class RendererFactory extends VBORendererSet {
    createDrawColorRenderer() {
        return new VBOTrianglesInstancingDrawColorRenderer(this.renderContext);
    }
    createDrawColorSAORenderer() {
        return new VBOTrianglesInstancingDrawColorSAORenderer(this.renderContext);
    }
    createDrawDepthRenderer() {
        return new VBOTrianglesInstancingDrawDepthRenderer(this.renderContext);
    }
    createSilhouetteRenderer() {
        return new VBOTrianglesInstancingSilhouetteRenderer(this.renderContext);
    }
    createPickMeshRenderer() {
        return new VBOTrianglesInstancingPickMeshRenderer(this.renderContext);
    }
    createEdgesColorRenderer() {
        return new VBOTrianglesInstancingEdgesDrawRenderer(this.renderContext);
    }
    createEdgesSilhouetteRenderer() {
        return new VBOTrianglesInstancingEdgesSilhouetteRenderer(this.renderContext);
    }
}
/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer) => {
    return new RendererFactory(webglRenderer);
}));
//# sourceMappingURL=rendererFactory.js.map