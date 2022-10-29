import {Program} from "../../../../../../../lib/webgl/Program";
import {createRTCViewMat, getPlaneRTCPos} from "../../../../../../math/rtcCoords.js";
import {math} from "../../../../../../math/math.js";

const tempVec3a = math.vec3();

/**
 * @private
 */
class TrianglesInstancingFlatNormalsRenderer {

    constructor(scene) {
        this.#scene = scene;
        this.#hash = this._getHash();
        this._allocate();
    }

    getValid() {
        return this.#hash === this._getHash();
    };

    _getHash() {
        return this.#scene.#sectionPlanesState.getHash();
    }

    drawLayer(frameContext, instancingLayer, renderPass) {

        const model = instancingLayer.model;
        const scene = model.scene;
        const camera = scene.camera;
        const gl = scene.canvas.gl;
        const state = instancingLayer.state;
        const geometry = state.geometry;
        const origin = instancingLayer.state.origin;

        if (!this.#program) {
            this._allocate(instancingLayer);
            if (this.errors) {
                return;
            }
        }

        if (frameContext.lastProgramId !== this.#program.id) {
            frameContext.lastProgramId = this.#program.id;
            this._bindProgram();
        }

        gl.uniform1i(this.#uRenderPass, renderPass);

        gl.uniformMatrix4fv(this._uViewMatrix, false, (origin) ? createRTCViewMat(camera.viewMatrix, origin) : camera.viewMatrix);
        gl.uniformMatrix4fv(this._uWorldMatrix, false, model.worldMatrix);

        const numSectionPlanes = this.view.sectionPlanesList.length;
        if (numSectionPlanes > 0) {
            const sectionPlanes = scene.#sectionPlanesState.sectionPlanes;
            const baseIndex = instancingLayer.layerIndex * numSectionPlanes;
            const drawFlags = model.drawFlags;
            for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
                const sectionPlaneUniforms = this._uSectionPlanes[sectionPlaneIndex];
                const active = drawFlags.sectionPlanesActivePerLayer[baseIndex + sectionPlaneIndex];
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

        gl.uniformMatrix4fv(this._uPositionsDecompressMatrix, false, geometry.positionsDecompressMatrix);

        this._aModelMatrixCol0.bindArrayBuffer(state.modelMatrixCol0Buf);
        this._aModelMatrixCol1.bindArrayBuffer(state.modelMatrixCol1Buf);
        this._aModelMatrixCol2.bindArrayBuffer(state.modelMatrixCol2Buf);

        gl.vertexAttribDivisor(this._aModelMatrixCol0.location, 1);
        gl.vertexAttribDivisor(this._aModelMatrixCol1.location, 1);
        gl.vertexAttribDivisor(this._aModelMatrixCol2.location, 1);

        this._aPosition.bindArrayBuffer(geometry.positionsBuf);

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

        geometry.indicesBuf.bind();

        gl.drawElementsInstanced(gl.TRIANGLES, geometry.indicesBuf.numItems, geometry.indicesBuf.itemType, 0, state.numInstances);

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

        this.#uRenderPass = program.getLocation("renderPass");
        this._uPositionsDecodeMatrix = program.getLocation("positionsDecompressMatrix");
        this._uWorldMatrix = program.getLocation("worldMatrix");
        this._uViewMatrix = program.getLocation("viewMatrix");
        this._uProjMatrix = program.getLocation("projMatrix");
        this._uSectionPlanes = [];

        const clips = sectionPlanesState.sectionPlanes;
        for (let i = 0, len = clips.length; i < len; i++) {
            this._uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        this._aPosition = program.getAttribute("position");
        this._aOffset = program.getAttribute("offset");
        this._aColor = program.getAttribute("color");
        this._aFlags = program.getAttribute("flags");

        if (this._aFlags2) {
            this._aFlags2 = program.getAttribute("flags2");
        }

        this._aModelMatrixCol0 = program.getAttribute("modelMatrixCol0");
        this._aModelMatrixCol1 = program.getAttribute("modelMatrixCol1");
        this._aModelMatrixCol2 = program.getAttribute("modelMatrixCol2");

        if (this.view.logarithmicDepthBufferEnabled) {
            this._uLogDepthBufFC = program.getLocation("logDepthBufFC");
        }
    }

    _bindProgram() {

        const scene = this.#scene;
        const gl = scene.canvas.gl;
        const project = scene.camera.project;

        this.#program.bind();

        gl.uniformMatrix4fv(this._uProjMatrix, false, project.matrix);

        if (this.view.logarithmicDepthBufferEnabled) {
            const logDepthBufFC = 2.0 / (Math.log(project.far + 1.0) / Math.LN2);
            gl.uniform1f(this._uLogDepthBufFC, logDepthBufFC);
        }
    }

    _buildShader() {
        return {
            vertex: this.buildVertexShader()
    :
        string,
            fragment
    :
        this.buildFragmentShader()
    :
        string
    }

    }

    buildVertexShader(): string {
        const scene = this.#scene;
        const sectionPlanesState = scene.#sectionPlanesState;
        const clipping = this.view.sectionPlanesList.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// Instancing geometry flat normals drawing vertex shader");

        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        //if (scene.entityOffsetsEnabled) {
//            src.push("in vec3 offset;");
//        }
        src.push("in vec4 color;");
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        src.push("in vec4 modelMatrixCol0;");
        src.push("in vec4 modelMatrixCol1;");
        src.push("in vec4 modelMatrixCol2;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        if (this.view.logarithmicDepthBufferEnabled) {
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
        src.push("void main(void) {");
        // flags.x = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`if (int(flags.x) != renderPass) {`);
        src.push("      gl_Position = vec4(0.0, 0.0, 0.0, 0.0);");
        src.push("} else {");
        src.push("  vec4 worldPosition = positionsDecompressMatrix * vec4(position, 1.0); ");
        src.push("  worldPosition = worldMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0);");
        if (scene.entityOffsetsEnabled) {
            src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        }
        src.push("  vec4 viewPosition  = viewMatrix * worldPosition; ");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags2 = flags2;");
        }
        src.push("  vViewPosition = viewPosition;");
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
            src.push("isPerspective = float (isPerspectiveMatrix(projMatrix));");
        }
        src.push("gl_Position = clipPos;");
        src.push("}");
        src.push("}");
        return src.join("\n");
    }

    buildFragmentShader(): string {
        const scene = this.#scene;
        const sectionPlanesState = scene.#sectionPlanesState;
        const clipping = this.view.sectionPlanesList.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// Instancing geometry flat nornals drawing fragment shader");

        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("in float isPerspective;");
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in vec4 vFlags2;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec3 vViewPosition;");
        src.push("vec3 packNormalToRGB( const in vec3 normal ) {");
        src.push("    return normalize( normal ) * 0.5 + 0.5;");
        src.push("}");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("if (dist > 0.0) { discard; }");
            src.push("}");
        }
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("vec3 xTangent = dFdx( vViewPosition.xyz );");
        src.push("vec3 yTangent = dFdy( vViewPosition.xyz );");
        src.push("vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
        src.push("    outColor = vec4(packNormalToRGB(viewNormal), 1.0); ");
        src.push("}");
        return src.join("\n");
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

export {TrianglesInstancingFlatNormalsRenderer};