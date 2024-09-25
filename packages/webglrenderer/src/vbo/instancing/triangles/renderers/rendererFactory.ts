import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOTrianglesInstancingDrawColorRenderer} from "./VBOTrianglesInstancingDrawColorRenderer";
import {VBOTrianglesInstancingSilhouetteRenderer} from "./VBOTrianglesInstancingSilhouetteRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOTrianglesInstancingPickMeshRenderer} from "./VBOTrianglesInstancingPickMeshRenderer";
import {VBOTrianglesInstancingEdgesDrawRenderer} from "./VBOTrianglesInstancingEdgesDrawRenderer";
import {VBOTrianglesInstancingEdgesSilhouetteRenderer} from "./VBOTrianglesInstancingEdgesSilhouetteRenderer";
import {VBOTrianglesInstancingDrawDepthRenderer} from "./VBOTrianglesInstancingDrawDepthRenderer";
import {VBOTrianglesInstancingDrawColorSAORenderer} from "./VBOTrianglesInstancingDrawColorSAORenderer";


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
