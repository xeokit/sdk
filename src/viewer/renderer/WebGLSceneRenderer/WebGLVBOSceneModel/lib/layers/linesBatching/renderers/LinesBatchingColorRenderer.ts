import {Program} from "../../../../../lib/Program";
import * as math from "../../../../../../../math/index";
import {createRTCViewMat, getPlaneRTCPos} from "../../../../../../../math/index";
import {View} from "../../../../../../../view";
import {FrameContext} from "../../../../../lib/FrameContext";
import {LinesBatchingLayer} from "../LinesBatchingLayer";
import {Attribute} from "../../../../../lib/Attribute";

const tempVec3a = math.vec3();

/**
 * @private
 */
class LinesBatchingColorRenderer {

    #view: View;
    #hash: string;
    #program: Program;
    #aPosition: Attribute;
    #aColor: Attribute;
    #aFlags: Attribute;
    #aFlags2: Attribute;
    #aOffset: Attribute;
    #uPositionsDecompressMatrix: WebGLUniformLocation;
    #uRenderPass: WebGLUniformLocation;
    #uWorldMatrix: WebGLUniformLocation;
    #uViewMatrix: WebGLUniformLocation;
    #uProjMatrix: WebGLUniformLocation;
    #uSectionPlanes: any[];
    #uLogDepthBufFC: WebGLUniformLocation;
    #uPositionsDecodeMatrix: WebGLUniformLocation;
    errors: string[];

    constructor(view: View) {
        this.#view = view;
        this.#hash = this._getHash();
        this.#allocate();
    }

    getValid() :boolean{
        return this.#hash === this._getHash();
    };

    _getHash() :string{
        // @ts-ignore
        return this.#view.#sectionPlanesState.getHash();
    }

    drawLayer(frameCtx: FrameContext, linesBatchingLayer: LinesBatchingLayer, renderPass: number) {
        if (!this.#program) {
            this.#allocate();
            if (this.errors) {
                return;
            }
        }
        const view = this.#view;
        const camera = view.camera;
        const model = linesBatchingLayer.sceneModel;
        // @ts-ignore
        const gl = view.viewer.webglSceneRenderer.gl;
        const state = linesBatchingLayer.state;
        const origin = linesBatchingLayer.state.origin;
        if (frameCtx.lastProgramId !== this.#program.id) {
            frameCtx.lastProgramId = this.#program.id;
            this._bindProgram(frameCtx);
        }
        gl.uniform1i(this.#uRenderPass, renderPass);
        gl.uniformMatrix4fv(this.#uViewMatrix, false, (origin) ? createRTCViewMat(camera.viewMatrix, origin) : camera.viewMatrix);
        gl.uniformMatrix4fv(this.#uWorldMatrix, false, model.worldMatrix);
        gl.lineWidth(view.linesMaterial.lineWidth);
        // @ts-ignore
        const numSectionPlanes = view.#sectionPlanesState.sectionPlanes.length;
        if (numSectionPlanes > 0) {
            // @ts-ignore
            const sectionPlanes = view.#sectionPlanesState.sectionPlanes;
            const baseIndex = linesBatchingLayer.layerIndex * numSectionPlanes;
            const renderFlags = model.renderFlags;
            for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
                const sectionPlaneUniforms = this.#uSectionPlanes[sectionPlaneIndex];
                if (sectionPlaneUniforms) {
                    const active = renderFlags.sectionPlanesActivePerLayer[baseIndex + sectionPlaneIndex];
                    gl.uniform1i(sectionPlaneUniforms.active, active ? 1 : 0);
                    if (active) {
                        const sectionPlane = sectionPlanes[sectionPlaneIndex];
                        if (origin) {
                            const rtcSectionPlanePos = getPlaneRTCPos(sectionPlane.dist, sectionPlane.dir, origin, tempVec3a);
                            gl.uniform3fv(sectionPlaneUniforms.pos, rtcSectionPlanePos);
                        } else {
                            gl.uniform3fv(sectionPlaneUniforms.pos, sectionPlane.pos);
                        }
                        gl.uniform3fv(sectionPlaneUniforms.dir, sectionPlane.dir);
                    }
                }
            }
        }
        gl.uniformMatrix4fv(this.#uPositionsDecompressMatrix, false, linesBatchingLayer.state.positionsDecompressMatrix);
        this.#aPosition.bindArrayBuffer(state.positionsBuf);
        if (this.#aColor) {
            this.#aColor.bindArrayBuffer(state.colorsBuf);
        }
        if (this.#aFlags) {
            this.#aFlags.bindArrayBuffer(state.flagsBuf);
        }
        if (this.#aFlags2) {
            this.#aFlags2.bindArrayBuffer(state.flags2Buf);
        }
        if (this.#aOffset) {
            this.#aOffset.bindArrayBuffer(state.offsetsBuf);
        }
        state.indicesBuf.bind();
        gl.drawElements(gl.LINES, state.indicesBuf.numItems, state.indicesBuf.itemType, 0);
        frameCtx.drawElements++;
    }

    #allocate() {
        const view = this.#view;
        const gl = view.viewer.webglSceneRenderer.gl;
        this.#program = new Program(gl, this._buildShader());
        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }
        const program = this.#program;
        this.#uRenderPass = program.getLocation("renderPass");
        this.#uPositionsDecodeMatrix = program.getLocation("positionsDecompressMatrix");
        this.#uWorldMatrix = program.getLocation("worldMatrix");
        this.#uViewMatrix = program.getLocation("viewMatrix");
        this.#uProjMatrix = program.getLocation("projMatrix");
        this.#uSectionPlanes = [];
        // @ts-ignore
        for (let i = 0, len = view.#sectionPlanesState.sectionPlanes.length; i < len; i++) {
            this.#uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }
        this.#aPosition = program.getAttribute("position");
        this.#aOffset = program.getAttribute("offset");
        this.#aColor = program.getAttribute("color");
        this.#aFlags = program.getAttribute("flags");
        this.#aFlags2 = program.getAttribute("flags2");
        if (view.logarithmicDepthBufferEnabled) {
            this.#uLogDepthBufFC = program.getLocation("logDepthBufFC");
        }
    }

    _bindProgram(frameCtx: FrameContext) {
        const view = this.#view;
        const gl = view.viewer.webglSceneRenderer.gl;
        const program = this.#program;
        const project = view.camera.project;
        program.bind();
        gl.uniformMatrix4fv(this.#uProjMatrix, false, project.matrix)
        if (view.logarithmicDepthBufferEnabled) {
            const logDepthBufFC = 2.0 / (Math.log(project.far + 1.0) / Math.LN2);
            gl.uniform1f(this.#uLogDepthBufFC, logDepthBufFC);
        }
    }

    _buildShader() {
        return {
            vertex: this._buildVertexShader(),
            fragment: this._buildFragmentShader()
        };
    }

    _buildVertexShader() {
        const view = this.#view;
        // @ts-ignore
        const sectionPlanesState = view.#sectionPlanesState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        const src = [];
        src.push('#version 300 es');
        src.push("// Lines batching color vertex shader");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        src.push("in vec4 color;");
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
            src.push("in vec3 offset;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("out vec4 vColor;");
        src.push("void main(void) {");
        // flags.x = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`if (int(flags.x) != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("vec4 worldPosition = worldMatrix * (positionsDecompressMatrix * vec4(position, 1.0)); ");

            src.push("worldPosition.xyz = worldPosition.xyz + offset;");
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, float(color.a) / 255.0);");
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
        return src;
    }

    _buildFragmentShader() {
        const view = this.#view;
        // @ts-ignore
        const sectionPlanesState = view.#sectionPlanesState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        const src = [];
        src.push('#version 300 es');
        src.push("// Lines batching color fragment shader");
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
            for (let i = 0, len = sectionPlanesState.sectionPlanes.length; i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = sectionPlanesState.sectionPlanes.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { discard; }");
            src.push("}");
        }
        src.push("   outColor            = vColor;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("}");
        return src;
    }

    webglContextRestored() {
        this.#program = null;
    }

    destroy() {
        if (this.#program) {
            this.#program.destroy();
        }
        this.#program = null;
    }
}

export {LinesBatchingColorRenderer};