import {WebGLRenderer} from "../../viewing/webGLRenderer";
import type {Renderer} from "../../viewing/renderer";

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
  const webGLRenderer = asWebGLRenderer(renderer);
  if (!webGLRenderer) {
    throw new Error(`${owner}: requires a WebGLRenderer`);
  }
  return webGLRenderer;
}
