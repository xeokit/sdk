import {Program} from "../../../../../lib/Program.ts";
import {createRTCViewMat, getPlaneRTCPos} from "../../../../../../math/rtcCoords.js";
import {math} from "../../../../../../math/math.js";

const tempVec3a = math.vec3();

/**
 * Renders InstancingLayer fragment depths to a shadow map.
 *
 * @private
 */
class PointsInstancingShadowRenderer {

    constructor(scene) {
        this.#scene = scene;
        this.#hash = this._getHash();
        this._lastLightId = null;
        this._allocate();
    }

    getValid() {
        return this.#hash === this._getHash();
    };

    _getHash() {
        return this.#scene.#sectionPlanesState.getHash();
    }

    drawLayer( frameCtx, instancingLayer) {

        const model = instancingLayer.model;
        const scene = model.scene;
        const gl = scene.canvas.gl;
        const state = instancingLayer.state;

        if (!this.#program) {
            this._allocate();
            if (this.errors) {
                return;
            }
        }

        if (frameCtx.lastProgramId !== this.#program.id) {
            frameCtx.lastProgramId = this.#program.id;
            this._bindProgram(frameCtx, instancingLayer);
        }

        gl.uniformMatrix4fv(this.#uPositionsDecodeMatrix, false, geometry.positionsDecompressMatrix);

        this._aModelMatrixCol0.bindArrayBuffer(state.modelMatrixCol0Buf);
        this._aModelMatrixCol1.bindArrayBuffer(state.modelMatrixCol1Buf);
        this._aModelMatrixCol2.bindArrayBuffer(state.modelMatrixCol2Buf);

        gl.vertexAttribDivisor(this._aModelMatrixCol0.location, 1);
        gl.vertexAttribDivisor(this._aModelMatrixCol1.location, 1);
        gl.vertexAttribDivisor(this._aModelMatrixCol2.location, 1);

        this._aPosition.bindArrayBuffer(state.positionsBuf);

        if (this._aOffset) {
            this._aOffset.bindArrayBuffer(state.offsetsBuf);
            gl.vertexAttribDivisor(this._aOffset.location, 1);
        }

        this._aColor.bindArrayBuffer(state.colorsBuf);
        gl.vertexAttribDivisor(this._aColor.location, 1);

        this._aFlags.bindArrayBuffer(state.flagsBuf);
        gl.vertexAttribDivisor(this._aFlags.location, 1);

        if (this._aFlags2) {
            this._aFlags2.bindArrayBuffer(state.flags2Buf);
            gl.vertexAttribDivisor(this._aFlags2.location, 1);
        }

        // TODO: Section planes need to be set if RTC center has changed since last RTC center recorded on frameCtx

        const numSectionPlanes = scene.#sectionPlanesState.sectionPlanes.length;
        if (numSectionPlanes > 0) {
            const sectionPlanes = scene.#sectionPlanesState.sectionPlanes;
            const baseIndex = instancingLayer.layerIndex * numSectionPlanes;
            const renderFlags = model.renderFlags;
            const origin = instancingLayer.state.origin;
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

        gl.uniform1f(this.#uPointSize, 10);

        gl.drawArraysInstanced(gl.POINTS, 0, state.positionsBuf.numItems, state.numInstances);

        gl.vertexAttribDivisor(this._aModelMatrixCol0.location, 0);
        gl.vertexAttribDivisor(this._aModelMatrixCol1.location, 0);
        gl.vertexAttribDivisor(this._aModelMatrixCol2.location, 0);
        gl.vertexAttribDivisor(this._aColor.location, 0);
        gl.vertexAttribDivisor(this._aFlags.location, 0);

        if (this._aFlags2) { // Won't be in shader when not clipping
            gl.vertexAttribDivisor(this._aFlags2.location, 0);
        }

        if (this._aOffset) {
            gl.vertexAttribDivisor(this._aOffset.location, 0);
        }
    }

    _allocate() {
        const scene = this.#scene;
        const gl = scene.canvas.gl;
        const sectionPlanesState = scene.#sectionPlanesState;
        this.#program = new Program(gl, this._buildShader());
        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }
        const program = this.#program;
        this.#uPositionsDecodeMatrix = program.getLocation("positionsDecompressMatrix");
        this.#uShadowViewMatrix = program.getLocation("shadowViewMatrix");
        this.#uShadowProjMatrix = program.getLocation("shadowProjMatrix");
        this.#uSectionPlanes = [];
        const clips = sectionPlanesState.sectionPlanes;
        for (let i = 0, len = clips.length; i < len; i++) {
            this.#uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }
        this._aPosition = program.getAttribute("position");
        this._aOffset = program.getAttribute("offset");
        this._aColor = program.getAttribute("color");
        this._aFlags = program.getAttribute("flags");
        this._aFlags2 = program.getAttribute("flags2");
        this._aModelMatrixCol0 = program.getAttribute("modelMatrixCol0");
        this._aModelMatrixCol1 = program.getAttribute("modelMatrixCol1");
        this._aModelMatrixCol2 = program.getAttribute("modelMatrixCol2");
        this.#uPointSize = program.getLocation("pointSize");
    }

    _bindProgram(frameCtx, instancingLayer) {
        const scene = this.#scene;
        const gl = scene.canvas.gl;
        const program = this.#program;
        program.bind();
        gl.uniformMatrix4fv(this.#uShadowViewMatrix, false, frameCtx.shadowViewMatrix);
        gl.uniformMatrix4fv(this.#uShadowProjMatrix, false, frameCtx.shadowProjMatrix);
        this._lastLightId = null;
    }

    _buildShader() {
        return {
            vertex: this._buildVertexShader(),
            fragment: this._buildFragmentShader()
        };
    }

    _buildVertexShader() {
        const scene = this.#scene;
        const sectionPlanesState = scene.#sectionPlanesState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        const src = [];
        src.push ('#version 300 es');
        src.push("// Instancing geometry shadow drawing vertex shader");
        src.push("in vec3 position;");
        if (scene.entityOffsetsEnabled) {
            src.push("in vec3 offset;");
        }
        src.push("in vec4 color;");
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        src.push("in vec4 modelMatrixCol0;");
        src.push("in vec4 modelMatrixCol1;");
        src.push("in vec4 modelMatrixCol2;");
        src.push("uniform mat4 shadowViewMatrix;");
        src.push("uniform mat4 shadowProjMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        src.push("uniform float pointSize;");
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("void main(void) {");
        src.push("bool visible      = (float(flags.x) > 0.0);");
        src.push("bool transparent  = ((float(color.a) / 255.0) < 1.0);");
        src.push(`if (!visible || transparent) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("  vec4 worldPosition = positionsDecompressMatrix * vec4(position, 1.0); ");
        src.push("  worldPosition = vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0);");
        if (scene.entityOffsetsEnabled) {
            src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        }
        src.push("  vec4 viewPosition  = shadowViewMatrix * worldPosition; ");

        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags2 = flags2;");
        }
        src.push("  gl_Position = shadowProjMatrix * viewPosition;");
        src.push("}");
        src.push("gl_PointSize = pointSize;");
        src.push("}");
        return src;
    }

    _buildFragmentShader() {
        const scene = this.#scene;
        const sectionPlanesState = scene.#sectionPlanesState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        const src = [];
        src.push ('#version 300 es');
        src.push("// Instancing geometry depth drawing fragment shader");

        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (scene.logarithmicDepthBufferEnabled) {
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
        src.push("in vec3 vViewNormal;");
        src.push("vec3 packNormalToRGB( const in vec3 normal ) {");
        src.push("    return normalize( normal ) * 0.5 + 0.5;");
        src.push("}");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
        src.push("  float r = dot(cxy, cxy);");
        src.push("  if (r > 1.0) {");
        src.push("       discard;");
        src.push("  }");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = sectionPlanesState.sectionPlanes.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("if (dist > 0.0) { discard; }");
            src.push("}");
        }
        if (scene.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("    outColor = vec4(packNormalToRGB(vViewNormal), 1.0); ");
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

export {PointsInstancingShadowRenderer};