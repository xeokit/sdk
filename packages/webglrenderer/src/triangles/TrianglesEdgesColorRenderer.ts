import {TrianglesRenderer} from "./TrianglesRenderer";
import type {RenderContext} from "../RenderContext";

export class TrianglesEdgesColorRenderer extends TrianglesRenderer {

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