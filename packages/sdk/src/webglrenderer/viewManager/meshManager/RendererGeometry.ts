
/**
 * Represents a geometry in the WebGL renderer.
 * @private
 */
export class RendererGeometry  {

  /**
   * The number of times this geometry is used by a mesh
   */
  useCount: number;

  constructor() {
    this.useCount= 0;
  }
}
