import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {RENDER_PASSES} from "../../../../RENDER_PASSES";
import {createRTCViewMat} from "@xeokit/rtc";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOPointsBatchingSilhouetteRenderer extends VBOBatchingRenderer {

    getHash(): string {
        return "";
    }

    buildVertexShader(src: string[]) {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexSlicingDefs(src);
        src.push("uniform vec4 color;");
        src.push("uniform float pointSize;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }

        src.push("void main(void) {");
        // silhouetteFlag = NOT_RENDERED | SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | SILHOUETTE_XRAYED
        // renderPass = SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | | SILHOUETTE_XRAYED
        src.push(`int silhouetteFlag = int(flags) >> 4 & 0xF;`);
        src.push(`if (silhouetteFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
        }
        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        src.push("}");
        src.push("}");
    }

    buildFragmentShader(src: string[]) {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        this.fragmentHeader(src);
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in float vFlags;");
            for (let i = 0, len = view.getNumAllocatedSectionPlanes(); i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("uniform vec4 color;");
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
        src.push("outColor = color;");
        src.push("}");
    }

    drawVBOBatchingLayer(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        this.bind(renderPass);
        const view = this.renderContext.view;
        let material;
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
            material = view.xrayMaterial;
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
            material = view.highlightMaterial;
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
            material = view.selectedMaterial;
        } else {
            return;
        }
        const gl = this.renderContext.gl;
        const color = material.fillColor;
        const alpha = material.fillAlpha;
        gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], alpha);
        const attributes = this.attributes;
        const renderState = vboBatchingLayer.renderState;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
        }
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniformMatrix4fv(this.uniforms.positionsDecodeMatrix, false, <Float32Array | GLfloat[]>renderState.positionsDecodeMatrix);
        gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, <Float32Array | GLfloat[]>vboBatchingLayer.rendererModel.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        gl.drawArrays(gl.POINTS, 0, renderState.positionsBuf.numItems);
    }
}
