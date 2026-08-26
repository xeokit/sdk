import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import type {Renderer} from "@xeokit/sdk/viewing/rendering";

/**
 * Returns the WebGL renderer implementation when the generic renderer is WebGL.
 */
export function asWebGLRenderer(renderer: Renderer | null | undefined): WebGLRenderer | null {
  return renderer instanceof WebGLRenderer ? renderer : null;
}

/**
 * Resolves a WebGL renderer for panels that need WebGL-specific diagnostics.
 */
export function requireWebGLRenderer(renderer: Renderer, owner: string): WebGLRenderer {
  const webGL = asWebGLRenderer(renderer);
  if (!webGL) {
    throw new Error(`${owner}: requires a WebGLRenderer`);
  }
  return webGL;
}
