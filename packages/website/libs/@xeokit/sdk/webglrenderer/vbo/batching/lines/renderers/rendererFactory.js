import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
import { VBOLinesBatchingDrawColorRenderer } from "./VBOLinesBatchingDrawColorRenderer";
import { VBOLinesBatchingPickMeshRenderer } from "./VBOLinesBatchingPickMeshRenderer";
import { VBOLinesBatchingSilhouetteRenderer } from "./VBOLinesBatchingSilhouetteRenderer";
/**
 * @private
 */
class RendererFactory extends VBORendererSet {
    createDrawColorRenderer() {
        return new VBOLinesBatchingDrawColorRenderer(this.renderContext);
    }
    createPickMeshRenderer() {
        return new VBOLinesBatchingPickMeshRenderer(this.renderContext);
    }
    createSilhouetteRenderer() {
        return new VBOLinesBatchingSilhouetteRenderer(this.renderContext);
    }
}
/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer) => {
    return new RendererFactory(webglRenderer);
}));
//# sourceMappingURL=rendererFactory.js.map