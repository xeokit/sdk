import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBOBatchingRendererSet} from "../../VBOBatchingRendererSet";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";
import {VBOPointsBatchingColorRenderer} from "./VBOPointsBatchingColorRenderer";

/**
 * @private
 */
 class RendererFactory extends VBOBatchingRendererSet {
    createColorRenderer(): VBOBatchingRenderer {
       return new VBOPointsBatchingColorRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBOBatchingRendererSet => {
    return new RendererFactory(webglRenderer);
}));
