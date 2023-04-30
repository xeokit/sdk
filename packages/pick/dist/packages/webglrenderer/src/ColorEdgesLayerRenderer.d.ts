import { LayerRenderer } from "./LayerRenderer";
import type { RenderContext } from "./RenderContext";
export declare class ColorEdgesLayerRenderer extends LayerRenderer {
    constructor(renderContext: RenderContext);
    buildFragmentShader(): string;
    buildVertexShader(): string;
    getHash(): string;
}
