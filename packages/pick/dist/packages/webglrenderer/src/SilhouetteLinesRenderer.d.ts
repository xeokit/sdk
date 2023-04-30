import { LayerRenderer } from "./LayerRenderer";
import type { RenderContext } from "./RenderContext";
/**
 * Renders triangles in a Layer as a flat, uniformly-colored silhouette.
 * Used for X-ray, highlight and selection effects.
 */
export declare class SilhouetteLinesRenderer extends LayerRenderer {
    constructor(renderContext: RenderContext);
    getHash(): string;
    buildVertexShader(): string;
    buildFragmentShader(): string;
}
