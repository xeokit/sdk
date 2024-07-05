import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOPointsBatchingDrawRenderer extends VBOBatchingRenderer {

    getHash(): string {
        return "";
    }

    buildVertexShader(src: string[]) :void{
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexSlicingDefs(src);
//        src.push("in vec4 color;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (pointsMaterial.filterIntensity) {
            src.push("uniform vec2 intensityRange;");
        }

        src.push("out vec4 vColor;");
        src.push("void main(void) {");
        // colorFlag = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        // src.push(`int colorFlag = int(flags) & 0xF;`);
        // src.push(`if (colorFlag != renderPass) {`);
        // src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        // src.push("} else {");
        // if (pointsMaterial.filterIntensity) {
        //     src.push("float intensity = float(color.a) / 255.0;")
        //     src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
        //     src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        //     src.push("} else {");
        // }
        src.push("vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        //src.push("vec4 worldPosition =  vec4(position/2000.0, 1.0); ");
        //      src.push("vec4 worldPosition = (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");

        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        //    src.push("}");
        //     if (pointsMaterial.filterIntensity) {
        //         src.push("}");
        //     }
        src.push("}");
    }

    buildFragmentShader(src: string[]):void {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentSlicingDefs(src);
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        this.fragmentSlicingLogic(src);
        src.push("   outColor = vColor;");
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        gl.drawArrays(gl.POINTS, 0, vboBatchingLayer.renderState.positionsBuf.numItems);
    }
}
