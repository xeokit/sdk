import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {createRTCViewMat} from "@xeokit/rtc";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOPointsBatchingPickMeshRenderer extends VBOBatchingRenderer {

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
        src.push("in vec4 pickColor;");
        src.push("uniform float pointSize;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        // if (view.logarithmicDepthBufferEnabled) {
        //     src.push("uniform float logDepthBufFC;");
        //     src.push("out float vFragDepth;");
        // }

        src.push("out vec4 vPickColor;");
        src.push("void main(void) {");
        // pickFlag = NOT_RENDERED | PICK
        // renderPass = PICK
        src.push(`int pickFlag = int(flags) >> 12 & 0xF;`);
        src.push(`if (pickFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("  } else {");
        src.push("      vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("      vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("      vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
        if (clipping) {
            src.push("      vWorldPosition = worldPosition;");
            src.push("      vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        // if (view.logarithmicDepthBufferEnabled) {
        //     src.push("vFragDepth = 1.0 + clipPos.w;");
        // }
        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        src.push("gl_PointSize += 10.0;");
        src.push("  }");
        src.push("}");
    }

    buildFragmentShader(src: string[]) :void{
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        src.push(`#version 300 es
        // Points batching pick mesh vertex shader
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        precision highp int;
        #else;
        precision mediump float;
        precision mediump int;
        #endif`);
        // if (view.logarithmicDepthBufferEnabled) {
        //     src.push("uniform float logDepthBufFC;");
        //     src.push("in float vFragDepth;");
        // }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in float vFlags;");
            for (var i = 0; i < view.getNumAllocatedSectionPlanes(); i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vPickColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        if (clipping) {
            src.push("  bool clippable = (int(vFlags) >> 16 & 0xF) == 1;");
            src.push("  if (clippable) {");
            src.push("      float dist = 0.0;");
            for (let i = 0; i < view.getNumAllocatedSectionPlanes(); i++) {
                src.push("      if (sectionPlaneActive" + i + ") {");
                src.push("          dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("      }");
            }
            src.push("      if (dist > 0.0) { discard; }");
            src.push("  }");
        }
        // if (view.logarithmicDepthBufferEnabled) {
        //     src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        // }
        src.push("   outColor = vPickColor; ");
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number) {
        // this.bind(renderPass);
        // const view = this.renderContext.view;
        // const viewIndex = view.viewIndex;
        // const gl = this.renderContext.gl;
        // const attributes = this.attributes;
        // const renderState = vboBatchingLayer.renderState;
        // attributes.position.bindArrayBuffer(renderState.positionsBuf);
        // if (attributes.pickColor) {
        //     attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
        // }
        // if (attributes.flags) {
        //     attributes.flags.bindArrayBuffer(renderState.flagsBufs[viewIndex]);
        // }
        // gl.uniform1i(this.uniforms.renderPass, renderPass);
        // gl.uniformMatrix4fv(this.uniforms.positionsDecodeMatrix, false, <Float32Array | GLfloat[]>renderState.positionsDecodeMatrix);
        //
        // gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, <Float32Array | GLfloat[]>vboBatchingLayer.rendererModel.worldMatrix);
        // gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        // gl.drawArrays(gl.POINTS, 0, renderState.positionsBuf.numItems);
    }
}
