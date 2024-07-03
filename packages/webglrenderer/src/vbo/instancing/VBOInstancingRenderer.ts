import {WebGLAttribute, WebGLProgram} from "@xeokit/webglutils";
import {OrthoProjectionType} from "@xeokit/constants";
import {DirLight, PerspectiveProjection, PointLight} from "@xeokit/viewer";
import {RenderContext} from "../../RenderContext";
import {VBOInstancingLayer} from "./VBOInstancingLayer";
import {createRTCViewMat} from "@xeokit/rtc";

function joinSansComments(srcLines) {
    const src = [];
    let line;
    let n;
    for (let i = 0, len = srcLines.length; i < len; i++) {
        line = srcLines[i];
        n = line.indexOf("/");
        if (n > 0) {
            if (line.charAt(n + 1) === "/") {
                line = line.substring(0, n);
            }
        }
        src.push(line);
    }
    return src.join("\n");
}


/**
 * @private
 */
export abstract class VBOInstancingRenderer {

    renderContext: RenderContext;
    hash: string;
    program: WebGLProgram | null;
    errors: string[];

    instancing: boolean;
    edges: boolean;

    #needRebuild: boolean;

    uniforms: {
        pointCloudIntensityRange: WebGLUniformLocation;
        nearPlaneHeight: WebGLUniformLocation;
        color: WebGLUniformLocation;
        gammaFactor: WebGLUniformLocation;
        pickZNear: WebGLUniformLocation;
        logDepthBufFC: WebGLUniformLocation;
        renderPass: WebGLUniformLocation;
        snapCameraEyeRTC: WebGLUniformLocation;
        pointSize: WebGLUniformLocation;
        intensityRange: WebGLUniformLocation;
        pickZFar: WebGLUniformLocation;
        pickClipPos: WebGLUniformLocation;
        drawingBufferSize: WebGLUniformLocation;
        worldMatrix: WebGLUniformLocation;
        positionsDecodeMatrix: WebGLUniformLocation;
        sectionPlanes: any[];
        sceneModelMatrix: WebGLUniformLocation;
        projMatrix: WebGLUniformLocation;
        viewMatrix: WebGLUniformLocation;
        lightPos: WebGLUniformLocation[];
        lightDir: WebGLUniformLocation[];
        lightColor: WebGLUniformLocation[];
        lightAttenuation: WebGLUniformLocation[];
        lightAmbient: WebGLUniformLocation;
    };

    attributes: {
        color: WebGLAttribute;
        normal: WebGLAttribute;
        metallicRoughness: WebGLAttribute;
        intensity: WebGLAttribute;
        flags: WebGLAttribute;
        uv: WebGLAttribute;
        position: WebGLAttribute;
        pickColor: WebGLAttribute;

        // Instancing

        modelMatrix: WebGLAttribute;
        modelMatrixCol0: WebGLAttribute;
        modelMatrixCol1: WebGLAttribute;
        modelMatrixCol2: WebGLAttribute;
    };

    constructor(renderContext: RenderContext, cfg: { edges: boolean } = {edges: false}) {
        this.renderContext = renderContext;
        this.#needRebuild = true;
        //  this.instancing = cfg.instancing;
        this.edges = cfg.edges;
        this.build();
    }

    abstract getHash(): string;

    needRebuild() {
        this.#needRebuild = true;
    }

    getValid() {
        if (!this.#needRebuild) {
            return true;
        }
        this.#needRebuild = false;
        return this.hash === this.getHash();
    };

    build(): void {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;

        this.program = new WebGLProgram(gl, {
            vertex: joinSansComments(this.buildVertexShader()),
            fragment: joinSansComments(this.buildFragmentShader())
        });

        if (this.program.errors) {
            this.errors = this.program.errors;
            return;
        }

        const program = this.program;

        this.uniforms = {
            renderPass: program.getLocation("renderPass"),
            gammaFactor: program.getLocation("gammaFactor"),
            sceneModelMatrix: program.getLocation("sceneModelMatrix"),
            viewMatrix: program.getLocation("viewMatrix"),
            projMatrix: program.getLocation("projMatrix"),
            worldMatrix: program.getLocation("worldMatrix"),
            positionsDecodeMatrix: program.getLocation("positionsDecodeMatrix"),
            snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
            logDepthBufFC: program.getLocation("logDepthBufFC"),
            pointSize: program.getLocation("pointSize"),
            intensityRange: program.getLocation("intensityRange"),
            nearPlaneHeight: program.getLocation("nearPlaneHeight"),
            pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
            pickZNear: program.getLocation("pickZNear"),
            pickZFar: program.getLocation("pickZFar"),
            pickClipPos: program.getLocation("pickClipPos"),
            drawingBufferSize: program.getLocation("drawingBufferSize"),
            color: program.getLocation("color"),
            sectionPlanes: [],
            lightColor: [],
            lightDir: [],
            lightPos: [],
            lightAttenuation: [],
            lightAmbient: program.getLocation("lightAmbient")
        };

        const lights = view.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
        const     light = lights[i];
            if (light instanceof DirLight) {
                this.uniforms.lightColor[i] = program.getLocation("lightColor" + i);
                this.uniforms.lightPos[i] = null;
                this.uniforms.lightDir[i] = program.getLocation("lightDir" + i);
                break;
            } else {
                this.uniforms.lightColor[i] = program.getLocation("lightColor" + i);
                this.uniforms.lightPos[i] = program.getLocation("lightPos" + i);
                this.uniforms.lightDir[i] = null;
                this.uniforms.lightAttenuation[i] = program.getLocation("lightAttenuation" + i);
            }
        }

        const uniforms = this.uniforms;

        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            uniforms.sectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        this.attributes = {
            position: program.getAttribute("position"),
            normal: program.getAttribute("normal"),
            color: program.getAttribute("color"),
            uv: program.getAttribute("uv"),
            metallicRoughness: program.getAttribute("metallicRoughness"),
            intensity: program.getAttribute("intensity"),
            flags: program.getAttribute("flags"),
            pickColor: program.getAttribute("pickColor"),

            // Instancing

            modelMatrix: program.getAttribute("modelMatrix"),
            modelMatrixCol0: program.getAttribute("modelMatrixCol0"),
            modelMatrixCol1: program.getAttribute("modelMatrixCol1"),
            modelMatrixCol2: program.getAttribute("modelMatrixCol2")
        }

        this.hash = this.getHash();

        this.#needRebuild = false;
    }

    abstract buildVertexShader(): string[];

    abstract buildFragmentShader(): string[];

    protected get sectionPlanesHash(): string {
        return "";
    }

    bind(): void {
        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.uniforms;
        const projection = view.camera.projection;
        this.renderContext.textureUnit = 0;
        if (this.program && !this.getValid()) {
            this.program.destroy();
            this.program = null;
        }
        if (!this.program) {
            this.build();
            if (this.errors) {
                return;
            }
            this.renderContext.lastProgramId = -1;
        }
        if (!this.program) {
            return;
        }
        if (this.renderContext.lastProgramId === this.program.id) {
            return; // Already bound
        }
        this.program.bind();
        this.renderContext.lastProgramId = this.program.id;
        if (uniforms.projMatrix) {
            gl.uniformMatrix4fv(uniforms.projMatrix, false, <Float32Array | GLfloat[]>view.camera.projMatrix);
        }
        if (uniforms.pointSize) {
            gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
        }
        if (uniforms.nearPlaneHeight) {
            gl.uniform1f(uniforms.nearPlaneHeight, (view.camera.projectionType === OrthoProjectionType) ? 1.0 : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0))));
        }
        if (uniforms.pickZNear) {
            gl.uniform1f(uniforms.pickZNear, this.renderContext.pickZNear);
            gl.uniform1f(uniforms.pickZFar, this.renderContext.pickZFar);
        }
        if (uniforms.logDepthBufFC) {
            const logDepthBufFC = 2.0 / (Math.log((projection as PerspectiveProjection).far + 1.0) / Math.LN2);
            gl.uniform1f(uniforms.logDepthBufFC, logDepthBufFC);
        }
        if (uniforms.lightAmbient) {
            gl.uniform4fv(uniforms.lightAmbient, <Float32Array>view.getAmbientColorAndIntensity());
        }
        //
        // if (this._uGammaFactor) {
        //     gl.uniform1f(this._uGammaFactor, scene.gammaFactor);
        // }

        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light = view.lightsList[i];
            if (this.uniforms.lightColor[i]) {
                gl.uniform4f(this.uniforms.lightColor[i], light.color[0], light.color[1], light.color[2], light.intensity);
            }
            if (this.uniforms.lightPos[i]) {
                const pointLight = <PointLight>light;
                gl.uniform3fv(this.uniforms.lightPos[i], <Float32Array>pointLight.pos);
            }
            if (this.uniforms.lightDir[i]) {
                const dirLight = <DirLight>light;
                gl.uniform3fv(this.uniforms.lightDir[i], <Float32Array>dirLight.dir);
            }
        }
    }

    render(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        this.bind();
        const attributes = this.attributes;
        const renderState = vboInstancingLayer.renderState;
        const gl = this.renderContext.gl;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
            gl.vertexAttribDivisor(attributes.flags.location, 1);
        }
        if (attributes.uv) {
            attributes.uv.bindArrayBuffer(renderState.uvBuf);
        }
        if (attributes.metallicRoughness) {
            attributes.metallicRoughness.bindArrayBuffer(renderState.metallicRoughnessBuf);
        }
        if (attributes.normal) {
            attributes.normal.bindArrayBuffer(renderState.normalsBuf);
        }
        if (attributes.pickColor) {
            attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
            gl.vertexAttribDivisor(attributes.pickColor.location, 1);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
            gl.vertexAttribDivisor(attributes.color.location, 1);
        }
        if (attributes.intensity) {
            // attributes.intensity.bindArrayBuffer(renderState.intensitiesBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        if (attributes.modelMatrixCol0) {
            attributes.modelMatrixCol0.bindArrayBuffer(renderState.modelMatrixCol0Buf);
        }
        if (attributes.modelMatrixCol1) {
            attributes.modelMatrixCol1.bindArrayBuffer(renderState.modelMatrixCol1Buf);
        }
        if (attributes.modelMatrixCol2) {
            attributes.modelMatrixCol2.bindArrayBuffer(renderState.modelMatrixCol2Buf);
        }
        gl.vertexAttribDivisor(attributes.modelMatrixCol0.location, 1);
        gl.vertexAttribDivisor(attributes.modelMatrixCol1.location, 1);
        gl.vertexAttribDivisor(attributes.modelMatrixCol2.location, 1);


        gl.uniformMatrix4fv(this.uniforms.positionsDecodeMatrix, false, <Float32Array | GLfloat[]>renderState.positionsDecodeMatrix);
        gl.uniformMatrix4fv(this.uniforms.worldMatrix, false, <Float32Array | GLfloat[]>vboInstancingLayer.rendererModel.worldMatrix);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));

        if (renderState.indicesBuf) {
            renderState.indicesBuf.bind();
        }
        this.draw(vboInstancingLayer, renderPass);
    }

    abstract draw(layer: VBOInstancingLayer, renderPass: number);

    destroy() {
        if (this.program) {
            this.program.destroy();
        }
        this.program = null;
    }
}
