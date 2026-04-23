import {DrawTechnique} from "../../DrawTechnique";

/**
 * @internal
 */
export class TrianglesSnapTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    // TODO: snap vertex shader
  }

  protected buildFragmentShader(): void {
    // TODO: snap fragment shader
  }
}
