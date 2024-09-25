import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOTrianglesBatchingDrawColorRenderer} from "./VBOTrianglesBatchingDrawColorRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOTrianglesBatchingPickMeshRenderer} from "./VBOTrianglesBatchingPickMeshRenderer";
import {VBOTrianglesBatchingSilhouetteRenderer} from "./VBOTrianglesBatchingSilhouetteRenderer";
import {VBOTrianglesBatchingEdgesDrawRenderer} from "./VBOTrianglesBatchingEdgesDrawRenderer";
import {VBOTrianglesBatchingEdgesSilhouetteRenderer} from "./VBOTrianglesBatchingEdgesSilhouetteRenderer";
import {VBOTrianglesBatchingDrawDepthRenderer} from "./VBOTrianglesBatchingDrawDepthRenderer";
import {VBOTrianglesBatchingDrawColorSAORenderer} from "./VBOTrianglesBatchingDrawColorSAORenderer";


/**
 * @private
 */
class RendererFactory extends VBORendererSet {

    createDrawColorRenderer(): VBORenderer {
        return new VBOTrianglesBatchingDrawColorRenderer(this.renderContext);
    }

    createDrawColorSAORenderer(): VBORenderer {
        return new VBOTrianglesBatchingDrawColorSAORenderer(this.renderContext);
    }

    createDrawDepthRenderer(): VBORenderer {
        return new VBOTrianglesBatchingDrawDepthRenderer(this.renderContext);
    }

    createPickMeshRenderer(): VBORenderer {
        return new VBOTrianglesBatchingPickMeshRenderer(this.renderContext);
    }

    createSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesBatchingSilhouetteRenderer(this.renderContext);
    }

    createEdgesColorRenderer(): VBORenderer {
        return new VBOTrianglesBatchingEdgesDrawRenderer(this.renderContext);
    }

    createEdgesSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesBatchingEdgesSilhouetteRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
    return new RendererFactory(webglRenderer);
}));
