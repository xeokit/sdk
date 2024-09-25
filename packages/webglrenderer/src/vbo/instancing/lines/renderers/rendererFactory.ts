import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOLinesInstancingDrawColorRenderer} from "./VBOLinesInstancingDrawColorRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOLinesInstancingPickMeshRenderer} from "./VBOLinesInstancingPickMeshRenderer";
import {VBOLinesInstancingSilhouetteRenderer} from "./VBOLinesInstancingSilhouetteRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

    createDrawColorRenderer(): VBORenderer {
        return new VBOLinesInstancingDrawColorRenderer(this.renderContext);
    }

    createPickMeshRenderer(): VBORenderer {
        return new VBOLinesInstancingPickMeshRenderer(this.renderContext);
    }

    createSilhouetteRenderer(): VBORenderer {
        return new VBOLinesInstancingSilhouetteRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
    return new RendererFactory(webglRenderer);
}));
