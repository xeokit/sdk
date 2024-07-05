import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOTrianglesBatchingDrawRenderer} from "./VBOTrianglesBatchingDrawRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOTrianglesBatchingPickMeshRenderer} from "./VBOTrianglesBatchingPickMeshRenderer";
import {VBOTrianglesBatchingSilhouetteRenderer} from "./VBOTrianglesBatchingSilhouetteRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

    createDrawRenderer(): VBORenderer {
        return new VBOTrianglesBatchingDrawRenderer(this.renderContext);
    }

    createPickMeshRenderer(): VBORenderer {
        return new VBOTrianglesBatchingPickMeshRenderer(this.renderContext);
    }

    createSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesBatchingSilhouetteRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
    return new RendererFactory(webglRenderer);
}));
