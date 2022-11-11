import {LayerPrimitiveRenderer} from "./LayerPrimitiveRenderer";
import {View} from "../../viewer/index";

export class ColorEdgesRenderer extends LayerPrimitiveRenderer {

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