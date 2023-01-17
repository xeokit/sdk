import { LayerRenderer } from "./LayerRenderer";
import type { RenderContext } from "../RenderContext";
export declare class QualityColorTrianglesRenderer extends LayerRenderer {
    constructor(renderContext: RenderContext);
    buildVertexShader(): string;
    buildFragmentShader(): string;
    getHash(): string;
}
