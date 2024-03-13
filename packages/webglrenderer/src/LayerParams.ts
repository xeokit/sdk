import type {View} from "@xeokit/viewer";
import type {WebGLRendererModel} from "./WebGLRendererModel";
import type {RendererTextureSet} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export interface LayerParams { // Params for RendererLayer constructor
    gl: WebGL2RenderingContext;
    view: View;
    rendererModel: WebGLRendererModel;
    primitive: number;
    layerIndex: number;
    textureSet?: RendererTextureSet;
    origin:FloatArrayParam;
}
