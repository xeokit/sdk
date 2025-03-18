import { VBOPointsBatchingDrawColorRenderer } from "./VBOPointsBatchingDrawColorRenderer";
import { VBOPointsBatchingPickMeshRenderer } from "./VBOPointsBatchingPickMeshRenderer";
import { VBOPointsBatchingSilhouetteRenderer } from "./VBOPointsBatchingSilhouetteRenderer";
import { RendererSetFactory, VBORendererSet } from "../../../VBORendererSet";
/**
 * @private
 */
class RendererFactory extends VBORendererSet {
    createDrawColorRenderer() {
        return new VBOPointsBatchingDrawColorRenderer(this.renderContext);
    }
    createPickMeshRenderer() {
        return new VBOPointsBatchingPickMeshRenderer(this.renderContext);
    }
    createSilhouetteRenderer() {
        return new VBOPointsBatchingSilhouetteRenderer(this.renderContext);
    }
}
/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer) => {
    return new RendererFactory(webglRenderer);
}));
//# sourceMappingURL=rendererFactory.js.map