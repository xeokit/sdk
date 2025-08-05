import type {RendererGeometry} from "../../scene";

/**
 * @private
 */
export class WebGLRendererGeometry implements RendererGeometry {
  useCount: number;
  constructor() {
    this.useCount= 0;
  }
}
