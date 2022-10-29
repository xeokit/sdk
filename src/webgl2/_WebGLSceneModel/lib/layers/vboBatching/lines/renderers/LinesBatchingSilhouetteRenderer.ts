import {BasicVBOLayerRenderer} from "../../../BasicVBOLayerRenderer";
import {View} from "../../../../../../../viewer/view";

/**
 * @private
 */
class LinesBatchingSilhouetteRenderer extends BasicVBOLayerRenderer {

    constructor(view: View) {
        super(view);
    }

    getHash(): string {
        return this.view.getSectionPlanesHash();
    }

    buildVertexShader(): string {
        const view = this.view;
        const clipping = (view.sectionPlanesList.length > 0);
        const src = [];
        src.push('#version 300 es');
        src.push("// LinesBatchingSilhouetteRenderer");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        // if (view.entityOffsetsEnabled) {
        //     src.push("in vec3 offset;");
        // }
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        src.push("uniform vec4 color;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("void main(void) {");
        // flags.y = NOT_RENDERED | SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | SILHOUETTE_XRAYED
        // renderPass = SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | | SILHOUETTE_XRAYED
        src.push(`if (int(flags.y) != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("      vec4 worldPosition = worldMatrix * (positionsDecompressMatrix * vec4(position, 1.0)); ");
        // if (view.entityOffsetsEnabled) {
        //     src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        // }
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags2 = flags2;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
        }
        src.push("gl_Position = clipPos;");
        src.push("}");
        src.push("}");
        return src.join("\n");
    }

    buildFragmentShader(): string {
        const view = this.view;
        const clipping = (view.sectionPlanesList.length > 0);
        const src = [];
        src.push('#version 300 es');
        src.push("// LinesBatchingSilhouetteRenderer");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in vec4 vFlags2;");
            for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("uniform vec4 color;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { discard; }");
            src.push("}");
        }
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("outColor = color;");
        src.push("}");
        return src.join("\n");
    }

    drawElements(layer: any) {
        // @ts-ignore
        const gl = this.view.viewer.renderer.gl;
        gl.lineWidth(this.view.linesMaterial.lineWidth);
        gl.drawElements(gl.LINES, layer.state.indicesBuf.numItems, layer.state.indicesBuf.itemType, 0);
    }
}

export {LinesBatchingSilhouetteRenderer};