import type {View} from "@xeokit/viewer";
import type {WebGLRendererModel} from "./../../WebGLRendererModel";
import type {RendererTextureSet} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math";
import {RenderContext} from "./../../RenderContext";

/**
 * @private
 */
export interface VBOBatchingLayerParams {
    renderContext: RenderContext;
    rendererModel: WebGLRendererModel;
    primitive: number;
    layerIndex: number;
    textureSet?: RendererTextureSet;
    origin:FloatArrayParam;
}
