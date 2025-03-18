import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
import { VBOTrianglesBatchingDrawColorRenderer } from "./VBOTrianglesBatchingDrawColorRenderer";
import { VBOTrianglesBatchingPickMeshRenderer } from "./VBOTrianglesBatchingPickMeshRenderer";
import { VBOTrianglesBatchingSilhouetteRenderer } from "./VBOTrianglesBatchingSilhouetteRenderer";
import { VBOTrianglesBatchingEdgesDrawRenderer } from "./VBOTrianglesBatchingEdgesDrawRenderer";
import { VBOTrianglesBatchingEdgesSilhouetteRenderer } from "./VBOTrianglesBatchingEdgesSilhouetteRenderer";
import { VBOTrianglesBatchingDrawDepthRenderer } from "./VBOTrianglesBatchingDrawDepthRenderer";
import { VBOTrianglesBatchingDrawColorSAORenderer } from "./VBOTrianglesBatchingDrawColorSAORenderer";
/**
 * @private
 */
class RendererFactory extends VBORendererSet {
    createDrawColorRenderer() {
        return new VBOTrianglesBatchingDrawColorRenderer(this.renderContext);
    }
    createDrawColorSAORenderer() {
        return new VBOTrianglesBatchingDrawColorSAORenderer(this.renderContext);
    }
    createDrawDepthRenderer() {
        return new VBOTrianglesBatchingDrawDepthRenderer(this.renderContext);
    }
    createPickMeshRenderer() {
        return new VBOTrianglesBatchingPickMeshRenderer(this.renderContext);
    }
    createSilhouetteRenderer() {
        return new VBOTrianglesBatchingSilhouetteRenderer(this.renderContext);
    }
    createEdgesColorRenderer() {
        return new VBOTrianglesBatchingEdgesDrawRenderer(this.renderContext);
    }
    createEdgesSilhouetteRenderer() {
        return new VBOTrianglesBatchingEdgesSilhouetteRenderer(this.renderContext);
    }
}
/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer) => {
    return new RendererFactory(webglRenderer);
}));
//# sourceMappingURL=rendererFactory.js.map