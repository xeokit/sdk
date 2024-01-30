import {RenderContext} from "./RenderContext";
import {PerspectiveProjection, View} from "@xeokit/viewer";
import {WebGLProgram, WebGLSampler} from "@xeokit/webglutils";
import {LinesPrimitive, OrthoProjectionType, TrianglesPrimitive} from "@xeokit/constants";
import {createMat4, createVec3, createVec4, transformPoint3} from "@xeokit/matrix";
import {createRTCViewMat} from "@xeokit/rtc";
import {RENDER_PASSES} from "./RENDER_PASSES";
import {Layer} from "./Layer";

const tempVec4 = createVec4();
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempMat4a = createMat4();

const identityMat4 = createMat4();

/**
 * @private
 */
export abstract class LayerRenderer {

    renderContext: RenderContext;
    view: View;
    errors: string[] | undefined;

    uniforms: {
        renderPass: WebGLUniformLocation,
        sceneModelMatrix: WebGLUniformLocation,
        viewMatrix: WebGLUniformLocation,
        projMatrix: WebGLUniformLocation,
        worldMatrix: WebGLUniformLocation,
        cameraEyeRtc: WebGLUniformLocation,
        sectionPlanes: {
            pos: WebGLUniformLocation,
            dir: WebGLUniformLocation,
            active: WebGLUniformLocation
        }[];
        lights: {
            pos?: WebGLUniformLocation,
            dir?: WebGLUniformLocation,
            color: WebGLUniformLocation,
            attenuation?: WebGLUniformLocation
        }[];
        pickInvisible: WebGLUniformLocation;
        pickZFar: WebGLUniformLocation;
        pickZNear: WebGLUniformLocation;
        pointCloudIntensityRange: WebGLUniformLocation;
        nearPlaneHeight: WebGLUniformLocation;
        pointSize: WebGLUniformLocation;
        gammaFactor: WebGLUniformLocation;
        logDepthBufFC: WebGLUniformLocation;
        sao: WebGLUniformLocation;
        lightAmbient: WebGLUniformLocation;
        color: WebGLUniformLocation;
    }

    samplers: {
        viewMatrices: WebGLSampler;
        positionsCompressedDataTexture: WebGLSampler;
        indicesDataTexture: WebGLSampler;
        edgeIndices: WebGLSampler;
        perSubMeshInstancingMatricesDataTexture: WebGLSampler;
        perSubMeshAttributesDataTexture: WebGLSampler;
        eachEdgeOffset: WebGLSampler;
        perPrimitiveSubMeshDataTexture: WebGLSampler;
        eachEdgeMesh: WebGLSampler;
        baseColorMap: WebGLSampler;
        metallicRoughMap: WebGLSampler;
        emissiveMap: WebGLSampler;
        normalMap: WebGLSampler;
        occlusionMap: WebGLSampler;
    };

    hash: string;
    program: WebGLProgram | null;
    #needRebuild: boolean;

    constructor(renderContext: RenderContext) {
        this.renderContext = renderContext;
        this.view = renderContext.view;
        this.#needRebuild = true;
        this.build();
    }

    build(): void {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;

        this.program = new WebGLProgram(gl, {
            vertex: this.buildVertexShader(),
            fragment: this.buildFragmentShader()
        });

        if (this.program.errors) {
            this.errors = this.program.errors;
            return;
        }

        const program = this.program;

        this.uniforms = {
            renderPass: program.getLocation("renderPass"),
            sceneModelMatrix: program.getLocation("sceneModelMatrix"),
            viewMatrix: program.getLocation("viewMatrix"),
            projMatrix: program.getLocation("projMatrix"),
            worldMatrix: program.getLocation("worldMatrix"),
            cameraEyeRtc: program.getLocation("cameraEyeRtc"),
            sao: program.getLocation("sao"),
            logDepthBufFC: program.getLocation("logDepthBufFC"),
            gammaFactor: program.getLocation("gammaFactor"),
            pointSize: program.getLocation("pointSize"),
            nearPlaneHeight: program.getLocation("nearPlaneHeight"),
            pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
            pickZNear: program.getLocation("pickZNear"),
            pickZFar: program.getLocation("pickZFar"),
            pickInvisible: program.getLocation("pickInvisible"),
            color: program.getLocation("color"),
            lightAmbient: program.getLocation("lightAmbient"),
            lights: [],
            sectionPlanes: []
        };

        const uniforms = this.uniforms;

        const lights = view.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            switch (light.type) {
                case "dir":
                    const dirLightColorLocation = program.getLocation("lightColor" + i);
                    if (dirLightColorLocation) {
                        uniforms.lights.push({
                            color: program.getLocation("lightColor" + i),
                            dir: program.getLocation("lightDir" + i)
                        });
                    }
                    break;
                case "point":
                    const pointLightColorLocation = program.getLocation("lightColor" + i);
                    if (pointLightColorLocation) {
                        uniforms.lights.push({
                            color: program.getLocation("lightColor" + i),
                            pos: program.getLocation("lightPos" + i),
                            attenuation: program.getLocation("lightAttenuation" + i)
                        });
                    }
                    break;
            }
        }

        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            uniforms.sectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        this.samplers = {
            viewMatrices: program.getSampler("viewMatrices"),
            positionsCompressedDataTexture: program.getSampler("positionsCompressedDataTexture"),
            indicesDataTexture: program.getSampler("indicesDataTexture"),
            edgeIndices: program.getSampler("edgeIndices"),
            perSubMeshAttributesDataTexture: program.getSampler("perSubMeshAttributesDataTexture"),
            perSubMeshInstancingMatricesDataTexture: program.getSampler("perSubMeshInstancingMatricesDataTexture"),
            eachEdgeOffset: program.getSampler("perSubmeshOffsetDataTexture"),
            perPrimitiveSubMeshDataTexture: program.getSampler("perPrimitiveSubMeshDataTexture"),
            eachEdgeMesh: program.getSampler("eachEdgeMesh"),
            baseColorMap: program.getSampler("baseColorMap"),
            metallicRoughMap: program.getSampler("metallicRoughMap"),
            emissiveMap: program.getSampler("emissiveMap"),
            normalMap: program.getSampler("normalMap"),
            occlusionMap: program.getSampler("occlusionMap")
        };

        this.hash = this.getHash();
    }

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

    protected abstract buildVertexShader(): string;

    protected abstract buildFragmentShader(): string;

    protected abstract getHash(): string;

    bind() {
        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.uniforms;
        const projection = view.camera.projection;
        const renderPass = this.renderContext.renderPass;
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
        if (this.renderContext.lastProgramId === this.program.id) {
            return; // Already bound
        }
        this.renderContext.lastProgramId = this.program.id;

        if (uniforms.renderPass) {
            gl.uniform1i(uniforms.renderPass, renderPass);
        }
        if (uniforms.projMatrix) {
            gl.uniformMatrix4fv(uniforms.projMatrix, false, <Float32Array | GLfloat[]>view.camera.projMatrix);
        }
        if (uniforms.lightAmbient) {      // @ts-ignore
            gl.uniform4fv(uniforms.lightAmbient, view.getAmbientColorAndIntensity());
        }
        for (let i = 0, len = uniforms.lights.length; i < len; i++) {
            const fragLightSourceUniforms = uniforms.lights[i];
            const light = view.lightsList[i];
            if (fragLightSourceUniforms.color) {
                gl.uniform4f(fragLightSourceUniforms.color, light.color[0], light.color[1], light.color[2], light.intensity);
            }
            if (fragLightSourceUniforms.dir) { // @ts-ignore
                gl.uniform3f(fragLightSourceUniforms.dir, light.dir[0], light.dir[1], light.dir[2]);
            }
            if (fragLightSourceUniforms.pos) { // @ts-ignore
                gl.uniform3f(fragLightSourceUniforms.pos, light.pos[0], light.pos[1], light.pos[2]);
            }
            if (fragLightSourceUniforms.attenuation) { // @ts-ignore
                gl.uniform1f(fragLightSourceUniforms.attenuation, light.attenuation);
            }
        }
        if (uniforms.sao) {
            const sao = view.sao;
            const saoEnabled = sao.possible;
            if (saoEnabled) {
                const viewportWidth = gl.drawingBufferWidth;
                const viewportHeight = gl.drawingBufferHeight;
                tempVec4[0] = viewportWidth;
                tempVec4[1] = viewportHeight;
                tempVec4[2] = sao.blendCutoff;
                tempVec4[3] = sao.blendFactor;
                // @ts-ignore
                gl.uniform4fv(uniforms.sao, tempVec4);
                // program.bindTexture(this.uOcclusionTexture, renderContext.occlusionTexture, 0);
            }
        }
        if (uniforms.gammaFactor) {
            gl.uniform1f(uniforms.gammaFactor, view.gammaFactor);
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
        if (uniforms.pickInvisible) {
            gl.uniform1i(uniforms.pickInvisible, this.renderContext.pickInvisible ? 1 : 0);
        }
        if (uniforms.logDepthBufFC) {
            const logDepthBufFC = 2.0 / (Math.log((projection as PerspectiveProjection).far + 1.0) / Math.LN2);
            gl.uniform1f(uniforms.logDepthBufFC, logDepthBufFC);
        }
    }


    uploadViewTransform(layer: Layer) {
        const renderState = layer.renderState;
        const origin = renderState.origin;
        const renderContext = this.renderContext;
        const camera = renderContext.view.camera;
        const renderPass = renderContext.renderPass;
        const gl = this.renderContext.gl;
        const uniforms = this.uniforms;
        //const {position, rotationMatrix, rotationMatrixConjugate} = sceneModel;
        const position = createVec3();
        const rotationMatrix = identityMat4;
        const rotationMatrixConjugate = identityMat4;
        let rtcViewMatrix;
        let rtcCameraEye;
        const gotOrigin = (origin[0] !== 0 || origin[1] !== 0 || origin[2] !== 0);
        const gotPosition = (position[0] !== 0 || position[1] !== 0 || position[2] !== 0);
        if (gotOrigin || gotPosition) {
            const rtcOrigin = tempVec3a;
            if (gotOrigin) {
                const rotatedOrigin = transformPoint3(rotationMatrix, origin, tempVec3b);
                rtcOrigin[0] = rotatedOrigin[0];
                rtcOrigin[1] = rotatedOrigin[1];
                rtcOrigin[2] = rotatedOrigin[2];
            } else {
                rtcOrigin[0] = 0;
                rtcOrigin[1] = 0;
                rtcOrigin[2] = 0;
            }
            rtcOrigin[0] += position[0];
            rtcOrigin[1] += position[1];
            rtcOrigin[2] += position[2];
            rtcViewMatrix = createRTCViewMat(camera.viewMatrix, rtcOrigin, tempMat4a);
            rtcCameraEye = tempVec3c;
            rtcCameraEye[0] = camera.eye[0] - rtcOrigin[0];
            rtcCameraEye[1] = camera.eye[1] - rtcOrigin[1];
            rtcCameraEye[2] = camera.eye[2] - rtcOrigin[2];
        } else {
            rtcViewMatrix = camera.viewMatrix;
            rtcCameraEye = camera.eye;
        }
        gl.uniformMatrix4fv(uniforms.sceneModelMatrix, false, rotationMatrixConjugate);
        gl.uniformMatrix4fv(uniforms.viewMatrix, false, rtcViewMatrix);
        gl.uniformMatrix4fv(uniforms.projMatrix, false, camera.projMatrix);
        gl.uniform3fv(uniforms.cameraEyeRtc, rtcCameraEye);
        gl.uniform1i(uniforms.renderPass, renderPass);
        if (uniforms.worldMatrix) {
            gl.uniformMatrix4fv(uniforms.worldMatrix, false, <Float32Array | GLfloat[]>layer.rendererModel.worldMatrix);
        }
    }

    draw(layer: Layer) {

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

        const renderState = layer.renderState;
        const origin = renderState.origin;
        const program = this.program;
        const renderContext = this.renderContext;
        const camera = renderContext.view.camera;
        const renderPass = renderContext.renderPass;
        const gl = this.renderContext.gl;
        const view = this.renderContext.view;
        const uniforms = this.uniforms;
        const samplers = this.samplers;
        const sceneModel = layer.rendererModel.sceneModel;
        //const {position, rotationMatrix, rotationMatrixConjugate} = sceneModel;
        const position = createVec3();
        const rotationMatrix = identityMat4;
        const rotationMatrixConjugate = identityMat4;

        if (renderContext.lastProgramId !== program.id) {
            renderContext.lastProgramId = program.id;
            this.bind();
        }

        let rtcViewMatrix;
        let rtcCameraEye;

        const gotOrigin = (origin[0] !== 0 || origin[1] !== 0 || origin[2] !== 0);
        const gotPosition = (position[0] !== 0 || position[1] !== 0 || position[2] !== 0);
        if (gotOrigin || gotPosition) {
            const rtcOrigin = tempVec3a;
            if (gotOrigin) {
                const rotatedOrigin = transformPoint3(rotationMatrix, origin, tempVec3b);
                rtcOrigin[0] = rotatedOrigin[0];
                rtcOrigin[1] = rotatedOrigin[1];
                rtcOrigin[2] = rotatedOrigin[2];
            } else {
                rtcOrigin[0] = 0;
                rtcOrigin[1] = 0;
                rtcOrigin[2] = 0;
            }
            rtcOrigin[0] += position[0];
            rtcOrigin[1] += position[1];
            rtcOrigin[2] += position[2];
            rtcViewMatrix = createRTCViewMat(camera.viewMatrix, rtcOrigin, tempMat4a);
            rtcCameraEye = tempVec3c;
            rtcCameraEye[0] = camera.eye[0] - rtcOrigin[0];
            rtcCameraEye[1] = camera.eye[1] - rtcOrigin[1];
            rtcCameraEye[2] = camera.eye[2] - rtcOrigin[2];
        } else {
            rtcViewMatrix = camera.viewMatrix;
            rtcCameraEye = camera.eye;
        }

        gl.uniformMatrix4fv(uniforms.sceneModelMatrix, false, rotationMatrixConjugate);
        gl.uniformMatrix4fv(uniforms.viewMatrix, false, rtcViewMatrix);
        gl.uniformMatrix4fv(uniforms.projMatrix, false, camera.projMatrix);
        gl.uniform3fv(uniforms.cameraEyeRtc, rtcCameraEye);
        gl.uniform1i(uniforms.renderPass, renderPass);

        if (uniforms.worldMatrix) {
            gl.uniformMatrix4fv(uniforms.worldMatrix, false, <Float32Array | GLfloat[]>layer.rendererModel.worldMatrix);
        }
        if (uniforms.color) {
            if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
                const material = view.xrayMaterial;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
                const material = view.highlightMaterial;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
                const material = view.selectedMaterial;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else {
                gl.uniform4fv(uniforms.color, new Float32Array([1, 1, 1]));
            }
        }

        // if (view.sectionPlanesList.length) {
        //     const numSectionPlanes = view.sectionPlanesList.length;
        //     const origin = trianglesLayer.renderState.origin;
        //     const sectionPlanes = view.sectionPlanesList;
        //     const baseIndex = trianglesLayer.layerIndex * numSectionPlanes;
        //     const drawFlags = rendererModel.drawFlags;
        //     for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
        //         const sectionPlaneUniforms = this.uniforms.sectionPlanes[sectionPlaneIndex];
        //         if (sectionPlaneUniforms) {
        //             const active = drawFlags.sectionPlanesActivePerLayer[baseIndex + sectionPlaneIndex];
        //             gl.uniform1i(sectionPlaneUniforms.active, active ? 1 : 0);
        //             if (active) {
        //                 const sectionPlane = sectionPlanes[sectionPlaneIndex];
        //                 if (origin) {
        //                     const rtcSectionPlanePos = rtc.getPlaneRTCPos(sectionPlane.dist, sectionPlane.dir, origin, tempVec3a);
        //                     gl.uniform3fv(sectionPlaneUniforms.pos, rtcSectionPlanePos);
        //                 } else {
        //                     gl.uniform3fv(sectionPlaneUniforms.pos, sectionPlane.pos);
        //                 }
        //                 gl.uniform3fv(sectionPlaneUniforms.dir, sectionPlane.dir);
        //             }
        //         }
        //     }
        // }

        if (samplers.positionsCompressedDataTexture) {
            renderState.dataTextureSet.positionsCompressedDataTexture.bindTexture(program, samplers.positionsCompressedDataTexture, renderContext.nextTextureUnit);
        }

        if (samplers.perSubMeshInstancingMatricesDataTexture) {
            renderState.dataTextureSet.perSubMeshInstancingMatricesDataTexture.bindTexture(program, samplers.perSubMeshInstancingMatricesDataTexture, renderContext.nextTextureUnit);
        }

        if (samplers.perSubMeshAttributesDataTexture) {
            renderState.dataTextureSet.perSubMeshAttributesDataTexture.bindTexture(program, samplers.perSubMeshAttributesDataTexture, renderContext.nextTextureUnit);
        }

        const glPrimitive = (layer.primitive === TrianglesPrimitive ? gl.TRIANGLES : (layer.primitive === LinesPrimitive ? gl.LINES : gl.POINTS));

        if (samplers.perPrimitiveSubMeshDataTexture) {
            if (renderState.numIndices8Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh8BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices8BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(glPrimitive, 0, renderState.numIndices8Bits);
            }
            if (renderState.numIndices16Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh16BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices16BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(glPrimitive, 0, renderState.numIndices16Bits);
            }
            if (renderState.numIndices32Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh32BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices32BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(glPrimitive, 0, renderState.numIndices32Bits);
            }
        }

        if (samplers.baseColorMap) {
            samplers.baseColorMap.bindTexture(renderState.materialTextureSet.colorRendererTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.metallicRoughMap) {
            samplers.metallicRoughMap.bindTexture(renderState.materialTextureSet.metallicRoughnessRendererTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.emissiveMap) {
            samplers.emissiveMap.bindTexture(renderState.materialTextureSet.emissiveRendererTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.occlusionMap) {
            samplers.occlusionMap.bindTexture(renderState.materialTextureSet.occlusionRendererTexture.texture2D, renderContext.nextTextureUnit);
        }

    }

    //----------------------------------------------------------------------------
    // Vertex shader
    //----------------------------------------------------------------------------

    protected get vertHeader(): string {
        return `#version 300 es
                #ifdef GL_FRAGMENT_PRECISION_HIGH
                precision   highp       float;
                precision   highp       int;
                precision   highp       usampler2D;
                precision   highp       isampler2D;
                precision   highp       sampler2D;
                #else
                precision   mediump     float;
                precision   mediump     int;
                precision   mediump     usampler2D;
                precision   mediump     isampler2D;
                precision   mediump     sampler2D;
                uniform     int         renderPass;
                #endif`;
    }

    protected get vertCommonDefs(): string {
        return `uniform         int         renderPass;
                uniform         mat4        sceneModelMatrix;
                uniform         mat4        viewMatrix;
                uniform         mat4        projMatrix;
                uniform         vec3        uCameraEyeRtc;
                                vec3        positions[3];              
                bool isPerspectiveMatrix(mat4 m) {
                    return (m[2][3] == - 1.0);
                }`;
    }

    protected get vertLogDepthBufDefs(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `uniform float logDepthBufFC;
                    out float fragDepth;
                    out float isPerspective;`;
        } else {
            return "";
        }
    }

    protected get vertLogDepthBuf(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `fragDepth = 1.0 + clipPos.w;
                    isPerspective = float (isPerspectiveMatrix(projMatrix));`;
        } else {
            return "";
        }
    }

    protected get vertSlicingDefs(): string {
        return "";
        // return `vWorldPosition  = worldPosition;
        //         vFlags2         = flags2.r;`;
    }

    protected get vertSlicing(): string {
        return "";
        // return `vWorldPosition  = worldPosition;
        //         vFlags2         = flags2.r;`;
    }

    //----------------------------------------------------------------------------
    // Fragment shader
    //----------------------------------------------------------------------------

    protected get fragHeader(): string {
        return `#version 300 es
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp     float;
        precision highp     int;
        #else
        precision mediump   float;
        precision mediump   int;
        #endif`;
    }

    protected get fragColorDefs(): string {
        return `uniform vec4 color;
                out vec4 outColor;`;
    }

    protected get fragLogDepthBufDefs(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `in float isPerspective;
                    uniform float logDepthBufFC;
                    in float fragDepth;`;
        } else {
            return ""
        }
    }

    protected get fragLogDepthBuf(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return "gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( fragDepth ) * logDepthBufFC * 0.5;";
        } else {
            return "";
        }
    }

    protected get fragSlicingDefs(): string {
        const src = [];
        src.push(`in vec4 worldPosition;
                  in vec4 meshFlags2;`);
        for (let i = 0, len = this.renderContext.view.sectionPlanesList.length; i < len; i++) {
            src.push(`uniform bool sectionPlaneActive${i};
                      uniform vec3 sectionPlanePos${i};
                      uniform vec3 sectionPlaneDir${i};`);
        }
        return src.join("\n");
    }

    protected get fragSlicing(): string {
        const src = [];
        const clipping = (this.renderContext.view.sectionPlanesList.length > 0);
        if (clipping) {
            src.push(`bool clippable = (float(meshFlags2.x) > 0.0);
                      if (clippable) {
                          float dist = 0.0;`);
            for (let i = 0, len = this.renderContext.view.sectionPlanesList.length; i < len; i++) {
                src.push(`if (sectionPlaneActive${i}) {
                              dist += clamp(dot(-sectionPlaneDir${i}.xyz, worldPosition.xyz - sectionPlanePos${i}.xyz), 0.0, 1000.0);
                          }`);
            }
            src.push(`if (dist > 0.0) { 
                          discard;
                      }
                  }`);
        }
        return src.join("\n");
    }

    protected get fragGammaDefs(): string {
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

    protected get fragGamma(): string {
        return ``;
    }

    protected get fragColor(): string {
        return `outColor = color;`;
    }

    destroy() {
        if (this.program) {
            this.program.destroy();
        }
        this.program = null;
    }
}