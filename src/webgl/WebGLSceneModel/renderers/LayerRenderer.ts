import * as math from "../../../../viewer/math";
import {FrameContext} from "../../../../webgl/WebGLRenderer/FrameContext";
import {Attribute} from "../../../../lib/webgl/Attribute";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {View} from "../../../../viewer/view/View";
import {Program} from "../../../../lib/webgl/Program";
import {Sampler} from "../../../../lib/webgl/Sampler";
import {Perspective} from "../../../../viewer/view/camera/Perspective";

import {WEBGL_INFO} from "../../../../../webglInfo.js";
import {Layer} from "../layer/Layer";

const tempVec4 = math.vec4();
const tempVec3a = math.vec3();

/**
 * @private
 */
export abstract class LayerRenderer {

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

    #uCameraMatricesDataTexture: string;
    #uSceneModelMatricesDataTexture: any;
    #uPositionsDataTexture: any;
    #uEachMeshMatricesDataTexture: any;
    #uEachMeshAttributesDataTexture: any;
    #uEachEdgeOffsetDataTexture: any;
    #uEachTriangleMeshDataTexture: any;
    #uIndicesDataTexture: string;

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

    draw(frameContext: FrameContext, layer: Layer, renderPass: number) {

        const maxTextureUnits = WEBGL_INFO.MAX_TEXTURE_UNITS;

        const view = this.view;
        // @ts-ignore
        const gl = view.viewer.renderer.gl;
        const sceneModel = layer.sceneModel;
        const state = layer.state;

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

        if (this.#uCameraMatricesDataTexture) {
            state.dataTextureSet.cameraMatrices.bindTexture(gl, "uCameraMatricesDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uSceneModelMatricesDataTexture) {
            state.dataTextureSet.sceneModelMatrices.bindTexture(gl, "uSceneModelMatricesDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uPositionsDataTexture) {
            state.dataTextureSet.positions.bindTexture(gl, "uPositionsDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uEachMeshMatricesDataTexture) {
            state.dataTextureSet.eachMeshMatrices.bindTexture(gl, "uEachMeshMatricesDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uEachMeshAttributesDataTexture) {
            state.dataTextureSet.eachMeshAttributes.bindTexture(gl, "uEachMeshAttributesDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uEachEdgeOffsetDataTexture) {
            state.dataTextureSet.eachEdgeOffset.bindTexture(gl, "uEachEdgeOffsetDataTexture", frameContext.textureUnit);
            frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        }

        if (this.#uEachTriangleMeshDataTexture) {

            if (state.numIndices8Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_8Bits.bindTexture(gl, this.#uEachTriangleMeshDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                state.dataTextureSet.indices_8Bits.bindTexture(gl, this.#uIndicesDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices8Bits);
            }

            if (state.numIndices16Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_16Bits.bindTexture(gl, this.#uEachTriangleMeshDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                state.dataTextureSet.indices_16Bits.bindTexture(gl, this.#uIndicesDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices16Bits);
            }

            if (state.numIndices32Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_32Bits.bindTexture(gl, this.#uEachTriangleMeshDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                state.dataTextureSet.indices_32Bits.bindTexture(gl, this.#uIndicesDataTexture, frameContext.textureUnit);
                frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices32Bits);
            }
        }
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
        const gl = view.viewer.renderer.gl;

        this.#program = new Program(gl, this.#buildShader());

        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }

        const program = this.#program;

        this.#uRenderPass = program.getLocation("renderPass");

        // Light sources

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

        // Section planes

        this.#uSectionPlanes = [];
        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            this.#uSectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        // Data textures

        this.#uCameraMatricesDataTexture = "uCameraMatricesDataTexture";

        this.#uTexturePerObjectIdPositionsDecodeMatrix = "uTexturePerObjectIdPositionsDecodeMatrix"; // chipmunk
        this.#uTexturePerObjectIdColorsAndFlags = "uTexturePerObjectIdColorsAndFlags"; // chipmunk
        this.#uTexturePerVertexIdCoordinates = "uTexturePerVertexIdCoordinates"; // chipmunk
        this.#uTexturePerPolygonIdNormals = "uTexturePerPolygonIdNormals"; // chipmunk
        this.#uTexturePerPolygonIdIndices = "uTexturePerPolygonIdIndices"; // chipmunk
        this.#uTexturePerPolygonIdPortionIds = "uTexturePerPolygonIdPortionIds"; // chipmunk


        this.#uEachMeshMatricesDataTexture = "uEachMeshMatricesDataTexture";

        this.#uTexturePerObjectIdOffsets = "uTexturePerObjectIdOffsets"; // chipmunk

        // Material textures

        this.#uBaseColorMap = program.getSampler("uBaseColorMap");
        this.#uMetallicRoughMap = program.getSampler("uMetallicRoughMap");
        this.#uEmissiveMap = program.getSampler("uEmissiveMap");
        this.#uNormalMap = program.getSampler("uNormalMap");

        // Occlusion texture
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

        const maxTextureUnits = WEBGL_INFO.MAX_TEXTURE_UNITS;

        const view = this.view;
        // @ts-ignore
        const gl = view.viewer.renderer.gl;
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
        //     if (view.reflectionMapsList.length > 0 && lightsState.reflectionMaps[0].texture && this.#uReflectionMap) {
        //         this.#program.bindTexture(this.#uReflectionMap, lightsState.reflectionMaps[0].texture, frameContext.textureUnit);
        //         frameContext.textureUnit = (frameContext.textureUnit + 1) % maxTextureUnits;
        //         frameContext.bindTexture++;
        //     }
        // }
        //
        // if (this.#sLightMap) {
        //     if (lightsState.lightMaps.length > 0 && lightsState.lightMaps[0].texture && this.#uLightMap) {
        //         this.#program.bindTexture(this.#uLightMap, lightsState.lightMaps[0].texture, frameContext.textureUnit);
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
