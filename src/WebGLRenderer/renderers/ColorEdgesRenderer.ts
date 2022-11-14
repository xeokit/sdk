import {LayerPrimitiveRenderer} from "./LayerPrimitiveRenderer";

import {RenderContext} from "../RenderContext";

export class ColorEdgesRenderer extends LayerPrimitiveRenderer {

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