import {BasicVBOLayerRenderer} from "../../../BasicVBOLayerRenderer";
import {View} from "../../../../../../../viewer/view";

/**
 * @private
 */
export class PointsBatchingPickDepthRenderer extends BasicVBOLayerRenderer {

    constructor(view: View) {
        super(view);
    }

    getHash() {
        return this.view.getSectionPlanesHash() + this.view.pointsMaterial.hash;
    }

    buildVertexShader(): string {
        const clipping = this.view.sectionPlanesList.length > 0;
        const pointsMaterial = this.view.pointsMaterial.state;
        const src = [];
        src.push('#version 300 es');
        src.push("// PointsBatchingPickDepthRenderer");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        // if (scene.entityOffsetsEnabled) {
        //     src.push("in vec3 offset;");
        // }
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        src.push("uniform bool pickInvisible;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        src.push("uniform float pointSize;");
        if (this.view.pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("out vec4 vViewPosition;");
        src.push("void main(void) {");
        // flags.w = NOT_RENDERED | PICK
        // renderPass = PICK
        src.push(`if (int(flags.w) != renderPass) {`);
        src.push("      gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("  } else {");
        src.push("      vec4 worldPosition = worldMatrix * (positionsDecompressMatrix * vec4(position, 1.0)); ");
        // if (scene.entityOffsetsEnabled) {
        //     src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        // }
        src.push("      vec4 viewPosition  = viewMatrix * worldPosition; ");
        if (clipping) {
            src.push("      vWorldPosition = worldPosition;");
            src.push("      vFlags2 = flags2;");
        }
        src.push("vViewPosition = viewPosition;");
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (this.view.logarithmicDepthBufferEnabled) {
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
        src.push("gl_PointSize += 10.0;");
        src.push("  }");
        src.push("}");
        return src.join("\n");
    }

    buildFragmentShader(): string {
        const clipping = this.view.sectionPlanesList.length > 0;
        const src = [];
        src.push('#version 300 es');
        src.push("// PointsBatchingPickDepthRenderer");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        src.push("uniform float pickZNear;");
        src.push("uniform float pickZFar;");
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in vec4 vFlags2;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vViewPosition;");
        src.push("vec4 packDepth(const in float depth) {");
        src.push("  const vec4 bitShift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);");
        src.push("  const vec4 bitMask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);");
        src.push("  vec4 res = fract(depth * bitShift);");
        src.push("  res -= res.xxyz * bitMask;");
        src.push("  return res;");
        src.push("}");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (this.view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("      float dist = 0.0;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("      if (sectionPlaneActive" + i + ") {");
                src.push("          dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("      }");
            }
            src.push("      if (dist > 0.0) { discard; }");
            src.push("  }");
        }
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("    float zNormalizedDepth = abs((pickZNear + vViewPosition.z) / (pickZFar - pickZNear));");
        src.push("    outColor = packDepth(zNormalizedDepth); ");  // Must be linear depth
        src.push("}");
        return src.join("\n");
    }

    drawElements(layer: any) {
        // @ts-ignore
        const gl = this.view.viewer.sceneRenderer.gl;
        gl.drawArrays(gl.POINTS, 0, layer.state.positionsBuf.numItems);
    }
}
