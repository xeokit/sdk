import {LayerRenderer} from "./LayerRenderer";
import type {RenderContext} from "./RenderContext";

export class ColorEdgesLayerRenderer extends LayerRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext);
    }

    buildFragmentShader(): string {
        return "";
    }

    buildVertexShader(): string {
        return "";
    }

    getHash(): string {
        return "";
    }
}