/**
 * Parameters for configuring a `Layer` in the `WebGLRenderer`.
 *
 * @private
 */
export interface LayerParams {
  /**
   * The rendering context associated with the layer.
   * This is typically shared across multiple layers and provides access to WebGL resources.
   */
  renderContext: any;

  /**
   * The primitive type used by the layer.
   * This defines the type of geometry rendered, such as points, lines, or triangles.
   */
  primitive: number;
}
