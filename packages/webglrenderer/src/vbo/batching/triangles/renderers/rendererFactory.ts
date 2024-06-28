import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBOBatchingRendererSet} from "../../VBOBatchingRendererSet";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";
import {VBOTrianglesBatchingColorRenderer} from "./VBOTrianglesBatchingColorRenderer";

/**
 * @private
 */
class RendererFactory extends VBOBatchingRendererSet {
    createColorRenderer(): VBOBatchingRenderer {
        return new VBOTrianglesBatchingColorRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBOBatchingRendererSet => {
    return new RendererFactory(webglRenderer);
}));
