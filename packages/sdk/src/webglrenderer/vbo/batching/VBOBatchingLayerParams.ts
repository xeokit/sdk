import { FloatArrayParam } from "../../../math";
import { RenderContext } from "../../RenderContext";
import type { RendererTextureSet } from "../../../scene";
import type { WebGLRendererModel } from "../../WebGLRendererModel";

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
