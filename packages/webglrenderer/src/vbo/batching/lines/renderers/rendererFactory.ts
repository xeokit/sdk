import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOLinesBatchingDrawColorRenderer} from "./VBOLinesBatchingDrawColorRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOLinesBatchingPickMeshRenderer} from "./VBOLinesBatchingPickMeshRenderer";
import {VBOLinesBatchingSilhouetteRenderer} from "./VBOLinesBatchingSilhouetteRenderer";

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
