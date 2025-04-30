import type { WebGLRendererModel } from "../../WebGLRendererModel";
import type { RendererTextureSet } from "../../../scene";
import { FloatArrayParam } from "../../../math";
import { RenderContext } from "../../RenderContext";

/**
 * @private
 */
export interface VBOBatchingLayerParams {
  renderContext: RenderContext;
  rendererModel: WebGLRendererModel;
  primitive: number;
  layerIndex: number;
  textureSet?: RendererTextureSet;
  origin: FloatArrayParam;
}
