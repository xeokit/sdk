
import {LayerRenderer} from "../LayerRenderer";

/**
 * @private
 */
export class TrianglesDrawColorRenderer extends LayerRenderer {

  getHash(): string {
    return `${this.lambertShadingHash}-${this.slicingHash}`;
  }

  buildVertexShader(src: string[]): void {
    this.vertexHeader(src);
    this.vertexCommonDefs(src);
    this.vertexSlicingDefs(src);
    this.vertexDrawLambertDefs(src);
    this.vertexDrawMainOpen(src);
    {
      this.vertexDrawLambertLogic(src);
      this.vertexSlicingLogic(src);
    }
    this.vertexMainClose(src);
  }

  buildFragmentShader(src: string[]): void {
    this.fragmentHeader(src);
    this.fragmentPrecisionDefs(src);
    this.fragmentCommonDefs(src);
    this.fragmentSlicingDefs(src);
    this.fragmentDrawLambertDefs(src);
    src.push("void main(void) {");
    {
      this.fragmentSlicingLogic(src);
      this.fragmentDrawLambertLogic(src);
      this.fragmentCommonOutput(src);
    }
    src.push("}");
  }

  // renderLayer(layer: Layer, renderPass: number): void {
  //   const attributes = this.attributes;
  //   const renderState = layer.renderState;
  //   const #renderContext = this.#renderContext;
  //   const view = this.#renderContext.view;
  //   const viewIndex = view.viewIndex;
  //   const gl = this.#renderContext.gl;
  //
  // }
}
