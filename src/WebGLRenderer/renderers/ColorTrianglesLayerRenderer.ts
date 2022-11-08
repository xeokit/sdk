import {LayerRenderer} from "./LayerRenderer";
import {View} from "../../viewer";

export class ColorTrianglesLayerRenderer extends LayerRenderer {

    constructor(view: View, gl: WebGL2RenderingContext) {
        super(view, gl);
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