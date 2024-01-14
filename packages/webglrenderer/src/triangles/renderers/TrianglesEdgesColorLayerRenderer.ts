import {TrianglesLayerRenderer} from "../TrianglesLayerRenderer";
import type {RenderContext} from "../../common/RenderContext";

export class TrianglesEdgesColorLayerRenderer extends TrianglesLayerRenderer {

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