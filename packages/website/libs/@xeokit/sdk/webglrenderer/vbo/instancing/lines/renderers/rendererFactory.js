import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
import { VBOLinesInstancingDrawColorRenderer } from "./VBOLinesInstancingDrawColorRenderer";
import { VBOLinesInstancingPickMeshRenderer } from "./VBOLinesInstancingPickMeshRenderer";
import { VBOLinesInstancingSilhouetteRenderer } from "./VBOLinesInstancingSilhouetteRenderer";
/**
 * @private
 */
class RendererFactory extends VBORendererSet {
    createDrawColorRenderer() {
        return new VBOLinesInstancingDrawColorRenderer(this.renderContext);
    }
    createPickMeshRenderer() {
        return new VBOLinesInstancingPickMeshRenderer(this.renderContext);
    }
    createSilhouetteRenderer() {
        return new VBOLinesInstancingSilhouetteRenderer(this.renderContext);
    }
}
/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer) => {
    return new RendererFactory(webglRenderer);
}));
//# sourceMappingURL=rendererFactory.js.map