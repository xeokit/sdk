import {DrawTechnique} from "../../DrawTechnique";

/**
 * @internal
 */
export class TrianglesSnapInitTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    // TODO: snap init vertex shader
  }

  protected buildFragmentShader(): void {
    // TODO: snap init fragment shader
  }
}
