import * as math from "../../../../viewer/math/index";
import {FrameContext} from "../../../lib/FrameContext";
import {Attribute} from "../../../lib/Attribute";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {View} from "../../../../viewer/view/View";
import {Program} from "../../../lib/Program";
import {Sampler} from "../../../lib/Sampler";
import {Perspective} from "../../../../viewer/view/camera/Perspective";

const tempVec4 = math.vec4();
const tempVec3a = math.vec3();

/**
 * @private
 */
export abstract class BasicVBOLayerRenderer {

    errors: any;
    view: View;
    #hash: null | string;

    #program: Program;

    #uSectionPlanes: any;
    #uViewMatrix: WebGLUniformLocation;
    #uViewNormalMatrix: WebGLUniformLocation;
    #uWorldMatrix: WebGLUniformLocation;
    #uWorldNormalMatrix: WebGLUniformLocation;
    #uRenderPass: WebGLUniformLocation;
    #uPositionsDecodeMatrix: WebGLUniformLocation;
    #uProjMatrix: WebGLUniformLocation;
    #uLightAmbient: WebGLUniformLocation;
    #uLightColor: WebGLUniformLocation[];
    #uLightDir: WebGLUniformLocation[];
    #uLightPos: WebGLUniformLocation[];
    #uLightAttenuation: WebGLUniformLocation[];
    #uOcclusionTexture: string;
    #uSAOParams: WebGLUniformLocation;
    #uLogDepthBufFC: WebGLUniformLocation;
    #aUV: WebGLUniformLocation;
    #uGammaFactor: WebGLUniformLocation;
    #uBaseColorMap: Sampler;
    #uMetallicRoughMap: Sampler;
    #uEmissiveMap: Sampler;
    #uNormalMap: Sampler;
    #uReflectionMap: Sampler;
    #uLightMap: Sampler;
    #uColor: WebGLUniformLocation;
    #uPointSize: WebGLUniformLocation;
    #uIntensityRange: WebGLUniformLocation;
    #uNearPlaneHeight: WebGLUniformLocation;
    #uPickZNear: WebGLUniformLocation;
    #uPickZFar: WebGLUniformLocation;
    #uPickInvisible: WebGLUniformLocation;
    #uPickViewMatrix: any;

    #aModelMatrixCol0: Attribute;
    #aModelMatrixCol1: Attribute;
    #aModelMatrixCol2: Attribute;
    #aModelNormalMatrixCol0: Attribute;
    #aModelNormalMatrixCol1: Attribute;
    #aModelNormalMatrixCol2: Attribute;
    #aPosition: Attribute;
    #aNormal: Attribute;
    #aColor: Attribute;
    #aFlags: Attribute;
    #aFlags2: Attribute;
    #aOffset: Attribute;
    #aMetallicRoughness: Attribute;

    constructor(view: View) {
        this.view = view;
        this.#allocate();
    }

    abstract getHash(): string ;

    abstract buildVertexShader(): string;

    abstract buildFragmentShader(): string;

    drawElements(layer: any) {
    }

    getValid() {
        return this.#hash === this.getHash();
    };

    draw(frameContext: FrameContext, layer: any, renderPass: number) {

        const view = this.view;
        // @ts-ignore
        const gl = view.viewer.sceneRenderer.gl;
        const sceneModel = layer.sceneModel;
        const state = layer.state;
        const camera = view.camera;
        const geometry = state.geometry;
        const origin = layer.state.origin;

        if (!this.#program) {
            this.#allocate();
            if (this.errors) {
                return;
            }
        }

        if (frameContext.lastProgramId !== this.#program.id) {
            frameContext.lastProgramId = this.#program.id;
            this.#bind(frameContext);
        }

        if (this.#uRenderPass) {
            gl.uniform1i(this.#uRenderPass, renderPass);
        }

        if (this.#uColor) {
            if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
                const material = view.xrayMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(this.#uColor, fillColor[0], fillColor[1], fillColor[2], fillAlpha);

            } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
                const material = view.highlightMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(this.#uColor, fillColor[0], fillColor[1], fillColor[2], fillAlpha);

            } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
                const material = view.selectedMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(this.#uColor, fillColor[0], fillColor[1], fillColor[2], fillAlpha);

            } else {
                gl.uniform4fv(this.#uColor, math.vec3([1, 1, 1]));
            }
        }

        if (view.sectionPlanesList.length) {
            const numSectionPlanes = view.sectionPlanesList.length;
            const origin = layer.state.origin;
            const sectionPlanes = view.sectionPlanesList;
            const baseIndex = layer.layerIndex * numSectionPlanes;
            const drawFlags = sceneModel.drawFlags;
            for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
                const sectionPlaneUniforms = this.#uSectionPlanes[sectionPlaneIndex];
                if (sectionPlaneUniforms) {
                    const active = drawFlags.sectionPlanesActivePerLayer[baseIndex + sectionPlaneIndex];
                    gl.uniform1i(sectionPlaneUniforms.active, active ? 1 : 0);
                    if (active) {
                        const sectionPlane = sectionPlanes[sectionPlaneIndex];
                        if (origin) {
                            const rtcSectionPlanePos = math.rtc.getPlaneRTCPos(sectionPlane.dist, sectionPlane.dir, origin, tempVec3a);
                            gl.uniform3fv(sectionPlaneUniforms.pos, rtcSectionPlanePos);
                        } else {
                            gl.uniform3fv(sectionPlaneUniforms.pos, sectionPlane.pos);
                        }
                        gl.uniform3fv(sectionPlaneUniforms.dir, sectionPlane.dir);
                    }
                }
            }
        }

        if (this.#uPickInvisible) {
            gl.uniform1i(this.#uPickInvisible, frameContext.pickInvisible ? 1 : 0);
        }

        if (this.#uPickViewMatrix) {
            const pickViewMatrix = frameContext.pickViewMatrix || camera.viewMatrix;
            gl.uniformMatrix4fv(this.#uPickViewMatrix, false, (origin) ? math.rtc.createRTCViewMat(pickViewMatrix, origin) : pickViewMatrix);
        }

        if (this.#uViewMatrix) {
            gl.uniformMatrix4fv(this.#uViewMatrix, false, (origin) ? math.rtc.createRTCViewMat(camera.viewMatrix, origin) : camera.viewMatrix);
        }

        if (this.#uViewNormalMatrix) {
            gl.uniformMatrix4fv(this.#uViewNormalMatrix, false, camera.viewNormalMatrix);
        }

        if (this.#uWorldMatrix) {
            gl.uniformMatrix4fv(this.#uWorldMatrix, false, sceneModel.worldMatrix);
        }

        if (this.#uWorldNormalMatrix) {
            gl.uniformMatrix4fv(this.#uWorldNormalMatrix, false, sceneModel.worldNormalMatrix);
        }

        if (this.#uPositionsDecodeMatrix) {
            gl.uniformMatrix4fv(this.#uPositionsDecodeMatrix, false, geometry.positionsDecompressMatrix);
        }

        if (this.#aModelMatrixCol0) {

            this.#aModelMatrixCol0.bindArrayBuffer(state.modelMatrixCol0Buf);
            this.#aModelMatrixCol1.bindArrayBuffer(state.modelMatrixCol1Buf);
            this.#aModelMatrixCol2.bindArrayBuffer(state.modelMatrixCol2Buf);

            gl.vertexAttribDivisor(this.#aModelMatrixCol0.location, 1);
            gl.vertexAttribDivisor(this.#aModelMatrixCol1.location, 1);
            gl.vertexAttribDivisor(this.#aModelMatrixCol2.location, 1);

            this.#aModelNormalMatrixCol0.bindArrayBuffer(state.modelNormalMatrixCol0Buf);
            this.#aModelNormalMatrixCol1.bindArrayBuffer(state.modelNormalMatrixCol1Buf);
            this.#aModelNormalMatrixCol2.bindArrayBuffer(state.modelNormalMatrixCol2Buf);

            gl.vertexAttribDivisor(this.#aModelNormalMatrixCol0.location, 1);
            gl.vertexAttribDivisor(this.#aModelNormalMatrixCol1.location, 1);
            gl.vertexAttribDivisor(this.#aModelNormalMatrixCol2.location, 1);
        }

        if (this.#aPosition) {

            // TODO: instancing?

            this.#aPosition.bindArrayBuffer(geometry.positionsBuf);
        }

        if (this.#aNormal) {

            // TODO: instancing?

            this.#aNormal.bindArrayBuffer(geometry.normalsBuf);
        }

        if (this.#aColor) {
            this.#aColor.bindArrayBuffer(state.colorsBuf);

            // TODO
            gl.vertexAttribDivisor(this.#aColor.location, 1);
        }

        if (this.#aFlags) {
            this.#aFlags.bindArrayBuffer(state.flagsBuf);

            // TODO
            gl.vertexAttribDivisor(this.#aFlags.location, 1);
        }

        if (this.#aFlags2) {
            this.#aFlags2.bindArrayBuffer(state.flags2Buf);
            // TODO

            gl.vertexAttribDivisor(this.#aFlags2.location, 1);
        }

        if (this.#aOffset) {
            this.#aOffset.bindArrayBuffer(state.offsetsBuf);
            // TODO

            gl.vertexAttribDivisor(this.#aOffset.location, 1);
        }

        if (geometry.indicesBuf) {
            geometry.indicesBuf.bind();
        }

        // if (this.#sBaseColorMap) {
        //     this.#program.bindTexture(this.#uBaseColorMap, textureSet.colorTexture.texture, frameContext.textureUnit);
        //     frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        // }
        //
        // if (this.#sMetallicRoughMap) {
        //     this.#program.bindTexture(this.#uMetallicRoughMap, textureSet.metallicRoughnessTexture.texture, frameContext.textureUnit);
        //     frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        // }
        //
        // if (this.#sEmissiveMap) {
        //     this.#program.bindTexture(this.#uEmissiveMap, textureSet.emissiveTexture.texture, frameContext.textureUnit);
        //     frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        // }
        //
        // if (this.#sNormalMap) {
        //     this.#program.bindTexture(this.#uNormalMap, textureSet.normalsTexture.texture, frameContext.textureUnit);
        //     frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        // }

        //gl.drawElementsInstanced(gl.TRIANGLES, geometry.indicesBuf.numItems, geometry.indicesBuf.itemType, 0, state.numInstances);

        this.drawElements(layer);

        frameContext.drawElements++;

        gl.vertexAttribDivisor(this.#aModelMatrixCol0.location, 0);
        gl.vertexAttribDivisor(this.#aModelMatrixCol1.location, 0);
        gl.vertexAttribDivisor(this.#aModelMatrixCol2.location, 0);
        gl.vertexAttribDivisor(this.#aModelNormalMatrixCol0.location, 0);
        gl.vertexAttribDivisor(this.#aModelNormalMatrixCol1.location, 0);
        gl.vertexAttribDivisor(this.#aModelNormalMatrixCol2.location, 0);
        gl.vertexAttribDivisor(this.#aColor.location, 0);
        gl.vertexAttribDivisor(this.#aFlags.location, 0);

        if (this.#aFlags2) { // Won't be in shader when not clipping
            gl.vertexAttribDivisor(this.#aFlags2.location, 0);
        }

        if (this.#aOffset) {
            gl.vertexAttribDivisor(this.#aOffset.location, 0);
        }
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

    protected getGammaFuncs(): string {
        return `uniform float gammaFactor;
        vec4 linearToLinear( in vec4 value ) {
            return value;
        }
        vec4 sRGBToLinear( in vec4 value ) {
            return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.w );
        }
        vec4 gammaToLinear( in vec4 value) {
            return vec4( pow( value.xyz, vec3( gammaFactor ) ), value.w );
        }
        vec4 linearToGamma( in vec4 value, in float gammaFactor ) {
              return vec4( pow( value.xyz, vec3( 1.0 / gammaFactor ) ), value.w );");
        }`;
    }

    protected getLightUniforms(): string {
        const view = this.view;
        const src = [];
        src.push("uniform vec4 lightAmbient;");
        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light: any = view.lightsList[i];
            if (light.type === "ambient") {
                continue;
            }
            src.push("uniform vec4 lightColor" + i + ";");
            if (light.type === "dir") {
                src.push("uniform vec3 lightDir" + i + ";");
            }
            if (light.type === "point") {
                src.push("uniform vec3 lightPos" + i + ";");
            }
            if (light.type === "spot") {
                src.push("uniform vec3 lightPos" + i + ";");
                src.push("uniform vec3 lightDir" + i + ";");
            }
        }
        return src.join("\n");
    }

    protected getSectionPlaneUniforms(): string {
        const view = this.view;
        const src = [];
        src.push("in vec4 vWorldPosition;");
        src.push("in vec4 vFlags2;");
        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            src.push("uniform bool sectionPlaneActive" + i + ";");
            src.push("uniform vec3 sectionPlanePos" + i + ";");
            src.push("uniform vec3 sectionPlaneDir" + i + ";");
        }
        return src.join("\n");
    }

    #allocate() {

        const view = this.view;

        // @ts-ignore
        const gl = view.viewer.sceneRenderer.gl;

        this.#program = new Program(gl, this.#buildShader());

        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }

        const program = this.#program;

        this.#uRenderPass = program.getLocation("renderPass");
        this.#uPositionsDecodeMatrix = program.getLocation("positionsDecompressMatrix");
        this.#uWorldMatrix = program.getLocation("worldMatrix");
        this.#uWorldNormalMatrix = program.getLocation("worldNormalMatrix");
        this.#uViewMatrix = program.getLocation("viewMatrix");
        this.#uViewNormalMatrix = program.getLocation("viewNormalMatrix");
        this.#uProjMatrix = program.getLocation("projMatrix");
        this.#uLightAmbient = program.getLocation("lightAmbient");
        this.#uColor = program.getLocation("color");
        this.#uLightColor = [];
        this.#uLightDir = [];
        this.#uLightPos = [];
        this.#uLightAttenuation = [];

        const lights = view.lightsList;

        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            switch (light.type) {
                case "dir":
                    this.#uLightColor[i] = program.getLocation("lightColor" + i);
                    this.#uLightPos[i] = null;
                    this.#uLightDir[i] = program.getLocation("lightDir" + i);
                    break;

                case "point":
                    this.#uLightColor[i] = program.getLocation("lightColor" + i);
                    this.#uLightPos[i] = program.getLocation("lightPos" + i);
                    this.#uLightDir[i] = null;
                    this.#uLightAttenuation[i] = program.getLocation("lightAttenuation" + i);
                    break;

                case "spot":
                    this.#uLightColor[i] = program.getLocation("lightColor" + i);
                    this.#uLightPos[i] = program.getLocation("lightPos" + i);
                    this.#uLightDir[i] = program.getLocation("lightDir" + i);
                    this.#uLightAttenuation[i] = program.getLocation("lightAttenuation" + i);
                    break;
            }
        }

        // if (view.reflectionMaps.length > 0) {
        //     this.#uReflectionMap = "reflectionMap";
        // }
        //
        // if (view.lightMaps.length > 0) {
        //     this.#uLightMap = "lightMap";
        // }

        this.#uSectionPlanes = [];

        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            this.#uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        this.#aPosition = program.getAttribute("position");
        this.#aNormal = program.getAttribute("normal");
        this.#aUV = program.getAttribute("uv");
        this.#aColor = program.getAttribute("color");
        this.#aMetallicRoughness = program.getAttribute("metallicRoughness");
        this.#aFlags = program.getAttribute("flags");
        this.#aFlags2 = program.getAttribute("flags2");
        this.#aOffset = program.getAttribute("offset");
        this.#uBaseColorMap = program.getSampler("uBaseColorMap");
        this.#uMetallicRoughMap = program.getSampler("uMetallicRoughMap");
        this.#uEmissiveMap = program.getSampler("uEmissiveMap");
        this.#uNormalMap = program.getSampler("uNormalMap");
        this.#aModelMatrixCol0 = program.getAttribute("modelMatrixCol0");
        this.#aModelMatrixCol1 = program.getAttribute("modelMatrixCol1");
        this.#aModelMatrixCol2 = program.getAttribute("modelMatrixCol2");
        this.#aModelNormalMatrixCol0 = program.getAttribute("modelNormalMatrixCol0");
        this.#aModelNormalMatrixCol1 = program.getAttribute("modelNormalMatrixCol1");
        this.#aModelNormalMatrixCol2 = program.getAttribute("modelNormalMatrixCol2");
        this.#uOcclusionTexture = "uOcclusionTexture";
        this.#uSAOParams = program.getLocation("uSAOParams");
        this.#uLogDepthBufFC = program.getLocation("logDepthBufFC");
        this.#uGammaFactor = program.getLocation("gammaFactor");
        this.#uPointSize = program.getLocation("pointSize");
        this.#uNearPlaneHeight = program.getLocation("nearPlaneHeight");
        this.#uIntensityRange = program.getLocation("intensityRange");

        this.#uPickZNear = program.getLocation("pickZNear");
        this.#uPickZFar = program.getLocation("pickZFar");
        this.#uPickInvisible = program.getLocation("pickInvisible");

        this.#hash = this.getHash();
    }

    #bind(frameContext: FrameContext) {
        const view = this.view;
        // @ts-ignore
        const gl = view.viewer.sceneRenderer.gl;
        const lights = view.lightsList;
        const project = view.camera.project;
        this.#program.bind();
        if (this.#uProjMatrix) {
            gl.uniformMatrix4fv(this.#uProjMatrix, false, project.matrix);
        }
        if (this.#uLightAmbient) {
            gl.uniform4fv(this.#uLightAmbient, view.getAmbientColorAndIntensity());
        }
        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            if (this.#uLightColor[i]) {
                gl.uniform4f(this.#uLightColor[i], light.color[0], light.color[1], light.color[2], light.intensity);
            }
            if (this.#uLightPos[i]) {
                gl.uniform3fv(this.#uLightPos[i], light.pos);
                if (this.#uLightAttenuation[i]) {
                    gl.uniform1f(this.#uLightAttenuation[i], light.attenuation);
                }
            }
            if (this.#uLightDir[i]) {
                gl.uniform3fv(this.#uLightDir[i], light.dir);
            }
        }
        // if (this.#sReflectionMap) {
        //     if (view.reflectionMapsList.length > 0 && lightsState.reflectionMaps[0].texture && this._uReflectionMap) {
        //         this.#program.bindTexture(this._uReflectionMap, lightsState.reflectionMaps[0].texture, frameContext.textureUnit);
        //         frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        //         frameContext.bindTexture++;
        //     }
        // }
        //
        // if (this.#sLightMap) {
        //     if (lightsState.lightMaps.length > 0 && lightsState.lightMaps[0].texture && this._uLightMap) {
        //         this.#program.bindTexture(this._uLightMap, lightsState.lightMaps[0].texture, frameContext.textureUnit);
        //         frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        //         frameContext.bindTexture++;
        //     }
        // }
        if (this.#uSAOParams) {
            const sao = view.sao;
            const saoEnabled = sao.possible;
            if (saoEnabled) {
                const viewportWidth = gl.drawingBufferWidth;
                const viewportHeight = gl.drawingBufferHeight;
                tempVec4[0] = viewportWidth;
                tempVec4[1] = viewportHeight;
                tempVec4[2] = sao.blendCutoff;
                tempVec4[3] = sao.blendFactor;
                gl.uniform4fv(this.#uSAOParams, tempVec4);
                this.#program.bindTexture(this.#uOcclusionTexture, frameContext.occlusionTexture, 0);
            }
        }
        if (view.logarithmicDepthBufferEnabled) {
            if (this.#uLogDepthBufFC) {
                const logDepthBufFC = 2.0 / (Math.log((project as Perspective).far + 1.0) / Math.LN2);
                gl.uniform1f(this.#uLogDepthBufFC, logDepthBufFC);
            }
        }
        if (this.#uGammaFactor) {
            gl.uniform1f(this.#uGammaFactor, view.gammaFactor);
        }
        if (this.#uPointSize) {
            gl.uniform1f(this.#uPointSize, view.pointsMaterial.pointSize);
        }
        if (this.#uNearPlaneHeight) {
            const nearPlaneHeight = (view.camera.projection === "ortho") ? 1.0 : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspective.fov * Math.PI / 180.0)));
            gl.uniform1f(this.#uNearPlaneHeight, nearPlaneHeight);
        }
        if (this.#uPickZNear) {
            gl.uniform1f(this.#uPickZNear, frameContext.pickZNear);
            gl.uniform1f(this.#uPickZFar, frameContext.pickZFar);
        }
        if (this.#uPickInvisible) {
            gl.uniform1i(this.#uPickInvisible, frameContext.pickInvisible);
        }
    }

    #buildShader() {
        return {
            vertex: this.buildVertexShader(),
            fragment: this.buildFragmentShader()
        };
    }
}
