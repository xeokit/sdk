import {RendererSetFactory, LayerRendererSet} from "../LayerRendererSet";
import type {LayerRenderer} from "../LayerRenderer";
import {TrianglesDrawColorRenderer} from "./TrianglesDrawColorRenderer";
import {RenderContext} from "../../RenderContext";

/**
 * @private
 */
class RendererFactory extends LayerRendererSet {

  createDrawColorRenderer(): LayerRenderer {
    return new TrianglesDrawColorRenderer(this.renderContext);
  }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((renderContext: RenderContext): LayerRendererSet => {
  return new RendererFactory(renderContext);
}));
