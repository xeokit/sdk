import {Program} from "../../../../../../webgl/Program.js";
import {createRTCViewMat, getPlaneRTCPos} from "../../../../../../math/rtcCoords.js";
import {math} from "../../../../../../math/math.js";

const tempVec3a = math.vec3();

/**
 * @private
 */
class TrianglesInstancingPickMeshRenderer {

    constructor(scene) {

        this.#scene = scene;
        this.#hash = this._getHash();

        this.#allocate();
    }

    getValid() {
        return this.#hash === this._getHash();
    };

    _getHash() {
        return this.#scene.#sectionPlanesState.getHash();
    }

    drawLayer(frameCtx, instancingLayer, renderPass) {

        const model = instancingLayer.model;
        const scene = model.scene;
        const camera = scene.camera;
        const gl = scene.canvas.gl;
        const state = instancingLayer.state;
        const geometry = state.geometry;
        const origin = instancingLayer.state.origin;

        if (!this.#program) {
            this.#allocate();
            if (this.errors) {
                return;
            }
        }

        if (frameCtx.lastProgramId !== this.#program.id) {
            frameCtx.lastProgramId = this.#program.id;
            this._bindProgram(frameCtx);
        }

        gl.uniform1i(this.#uRenderPass, renderPass);

        const pickViewMatrix = frameCtx.pickViewMatrix || camera.viewMatrix;
        const rtcPickViewMatrix = (origin) ? createRTCViewMat(pickViewMatrix, origin) : pickViewMatrix;

        gl.uniformMatrix4fv(this.#uViewMatrix, false, rtcPickViewMatrix);
        gl.uniformMatrix4fv(this.#uWorldMatrix, false, model.worldMatrix);

        gl.uniformMatrix4fv(this.#uProjMatrix, false, frameCtx.pickProjMatrix);

        if (scene.logarithmicDepthBufferEnabled) {
            const logDepthBufFC = 2.0 / (Math.log(camera.project.far + 1.0) / Math.LN2); // TODO: Far from pick project matrix?
            gl.uniform1f(this.#uLogDepthBufFC, logDepthBufFC);
        }

        gl.uniformMatrix4fv(this.#uPositionsDecodeMatrix, false, geometry.positionsDecompressMatrix);

        this.#aModelMatrixCol0.bindArrayBuffer(state.modelMatrixCol0Buf);
        this.#aModelMatrixCol1.bindArrayBuffer(state.modelMatrixCol1Buf);
        this.#aModelMatrixCol2.bindArrayBuffer(state.modelMatrixCol2Buf);

        gl.vertexAttribDivisor(this.#aModelMatrixCol0.location, 1);
        gl.vertexAttribDivisor(this.#aModelMatrixCol1.location, 1);
        gl.vertexAttribDivisor(this.#aModelMatrixCol2.location, 1);

        this.#aPickColor.bindArrayBuffer(state.pickColorsBuf);
        gl.vertexAttribDivisor(this.#aPickColor.location, 1);

        this.#aPosition.bindArrayBuffer(geometry.positionsBuf);

        this.#aFlags.bindArrayBuffer(state.flagsBuf);
        gl.vertexAttribDivisor(this.#aFlags.location, 1);

        if (this.#aFlags2) {
            this._aFlags2.bindArrayBuffer(state.flags2Buf);
            gl.vertexAttribDivisor(this._aFlags2.location, 1);
        }

        if (this._aOffset) {
            this._aOffset.bindArrayBuffer(state.offsetsBuf);
            gl.vertexAttribDivisor(this._aOffset.location, 1);
        }

        geometry.indicesBuf.bind();

        const numSectionPlanes = scene.#sectionPlanesState.sectionPlanes.length;
        if (numSectionPlanes > 0) {
            const sectionPlanes = scene.#sectionPlanesState.sectionPlanes;
            const baseIndex = instancingLayer.layerIndex * numSectionPlanes;
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

        gl.drawElementsInstanced(gl.TRIANGLES, geometry.indicesBuf.numItems, geometry.indicesBuf.itemType, 0, state.numInstances);

        // Cleanup

        gl.vertexAttribDivisor(this._aModelMatrixCol0.location, 0);
        gl.vertexAttribDivisor(this._aModelMatrixCol1.location, 0);
        gl.vertexAttribDivisor(this._aModelMatrixCol2.location, 0);
        gl.vertexAttribDivisor(this._aPickColor.location, 0);
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

        this.#uPickInvisible = program.getLocation("pickInvisible");
        this.#uPositionsDecodeMatrix = program.getLocation("positionsDecompressMatrix");
        this.#uWorldMatrix = program.getLocation("worldMatrix");
        this.#uViewMatrix = program.getLocation("viewMatrix");
        this.#uProjMatrix = program.getLocation("projMatrix");
        this.#uSectionPlanes = [];

        const clips = sectionPlanesState.sectionPlanes;

        for (let i = 0, len = clips.length; i < len; i++) {
            this.#uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        this.#uRenderPass = program.getLocation("renderPass");
        this._aPosition = program.getAttribute("position");
        this._aOffset = program.getAttribute("offset");
        this._aPickColor = program.getAttribute("pickColor");
        this._aFlags = program.getAttribute("flags");
        this._aFlags2 = program.getAttribute("flags2");
        this._aModelMatrixCol0 = program.getAttribute("modelMatrixCol0");
        this._aModelMatrixCol1 = program.getAttribute("modelMatrixCol1");
        this._aModelMatrixCol2 = program.getAttribute("modelMatrixCol2");

        if (scene.logarithmicDepthBufferEnabled) {
            this.#uLogDepthBufFC = program.getLocation("logDepthBufFC");
        }
    }

    _bindProgram(frameCtx) {

        const scene = this.#scene;
        const gl = scene.canvas.gl;
        const program = this.#program;

        program.bind();

        gl.uniform1i(this.#uPickInvisible, frameCtx.pickInvisible);
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
        src.push("#version 300 es");
        src.push("// Instancing geometry picking vertex shader");
        
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        if (scene.entityOffsetsEnabled) {
            src.push("in vec3 offset;");
        }
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        src.push("in vec4 pickColor;");

        src.push("in vec4 modelMatrixCol0;"); // Modeling matrix
        src.push("in vec4 modelMatrixCol1;");
        src.push("in vec4 modelMatrixCol2;");

        src.push("uniform bool pickInvisible;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");

        if (scene.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
            src.push("bool isPerspectiveMatrix(mat4 m) {");
            src.push("    return (m[2][3] == - 1.0);");
            src.push("}");
            src.push("out float isPerspective;");
        }

        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("out vec4 vPickColor;");
        src.push("void main(void) {");

        // flags.w = NOT_RENDERED | PICK
        // renderPass = PICK

        src.push(`if (int(flags.w) != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex

        src.push("} else {");


        src.push("  vec4 worldPosition = positionsDecompressMatrix * vec4(position, 1.0); ");
        src.push("  worldPosition = worldMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0);");
        if (scene.entityOffsetsEnabled) {
            src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        }

        src.push("  vec4 viewPosition  = viewMatrix * worldPosition; ");

        src.push("  vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
        if (clipping) {
            src.push("  vWorldPosition = worldPosition;");
            src.push("  vFlags2 = flags2;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (scene.logarithmicDepthBufferEnabled) {
           src.push("vFragDepth = 1.0 + clipPos.w;");
            src.push("isPerspective = float (isPerspectiveMatrix(projMatrix));");
        }
        src.push("gl_Position = clipPos;");
        src.push("}");
        src.push("}");
        return src;
    }

    _buildFragmentShader() {
        const scene = this.#scene;
        const sectionPlanesState = scene.#sectionPlanesState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// Batched geometry picking fragment shader");
        
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (scene.logarithmicDepthBufferEnabled) {
            src.push("in float isPerspective;");
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in vec4 vFlags2;");
            for (let i = 0; i < sectionPlanesState.sectionPlanes.length; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vPickColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0; i < sectionPlanesState.sectionPlanes.length; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("if (dist > 0.0) { discard; }");
            src.push("}");
        }
        if (scene.logarithmicDepthBufferEnabled) {
            src.push("    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("outColor = vPickColor; ");
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

export {TrianglesInstancingPickMeshRenderer};