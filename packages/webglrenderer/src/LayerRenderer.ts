import {createVec4} from "@xeokit/matrix";
import {OrthoProjectionType} from "@xeokit/constants";
import {AmbientLight, DirLight, PerspectiveProjection, PointLight} from "@xeokit/viewer";

import type {RenderContext} from "./RenderContext";
import {RENDER_PASSES} from "./RENDER_PASSES";
import type {Layer} from "./Layer";
import {GLProgram, GLSampler} from "@xeokit/webglutils";

const tempVec4 = createVec4();

/**
 * @private
 */
export abstract class LayerRenderer {

    /**
     * Initialization error messages
     */
    errors: string[] | undefined;

    protected renderContext: RenderContext;

    #hash: string;
    #program: GLProgram | null;
    #needRebuild: boolean;

    #uniforms: {
        renderPass: WebGLUniformLocation,
        viewMatrix: WebGLUniformLocation,
        projMatrix: WebGLUniformLocation,
        worldMatrix: WebGLUniformLocation,
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

    #samplers: {
        viewMatrices: GLSampler;
        positions: GLSampler;
        indices: GLSampler;
        edgeIndices: GLSampler;
        eachMeshMatrices: GLSampler;
        eachMeshAttributes: GLSampler;
        //    eachMeshOffsets: GLSampler;
        eachEdgeOffset: GLSampler;
        eachPrimitiveMesh: GLSampler;
        eachEdgeMesh: GLSampler;
        baseColorMap: GLSampler;
        metallicRoughMap: GLSampler;
        emissiveMap: GLSampler;
        normalMap: GLSampler;
        occlusionMap: GLSampler;
    };

    protected constructor(renderContext: RenderContext) {
        this.renderContext = renderContext;
        this.#needRebuild = true;
        this.#build();
    }

    #build(): void {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;

        this.#program = new GLProgram(gl, this.#buildShader());

        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }

        const program = this.#program;

        this.#uniforms = {
            renderPass: program.getLocation("renderPass"),
            viewMatrix: program.getLocation("viewMatrix"),
            projMatrix: program.getLocation("projMatrix"),
            worldMatrix: program.getLocation("worldMatrix"),
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

        const uniforms = this.#uniforms;

        const lights = view.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            switch (light.type) {
                case "dir":
                    uniforms.lights.push({
                        color: program.getLocation("lightColor" + i),
                        dir: program.getLocation("lightDir" + i)
                    });
                    break;
                case "point":
                    uniforms.lights.push({
                        color: program.getLocation("lightColor" + i),
                        pos: program.getLocation("lightPos" + i),
                        attenuation: program.getLocation("lightAttenuation" + i)
                    });
                    break;
                case "spot":
                    uniforms.lights.push({
                        color: program.getLocation("lightColor" + i),
                        pos: program.getLocation("lightPos" + i),
                        dir: program.getLocation("lightDir" + i),
                        attenuation: program.getLocation("lightAttenuation" + i)
                    });
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

        this.#samplers = {
            viewMatrices: program.getSampler("viewMatrices"),
            positions: program.getSampler("positions"),
            indices: program.getSampler("indices"),
            edgeIndices: program.getSampler("edgeIndices"),
            eachMeshAttributes: program.getSampler("eachMeshAttributes"),
            eachMeshMatrices: program.getSampler("eachMeshMatrices"),
            eachEdgeOffset: program.getSampler("eachMeshOffset"),
            eachPrimitiveMesh: program.getSampler("eachMeshTriangleMesh"),
            eachEdgeMesh: program.getSampler("eachEdgeMesh"),
            baseColorMap: program.getSampler("baseColorMap"),
            metallicRoughMap: program.getSampler("metallicRoughMap"),
            emissiveMap: program.getSampler("emissiveMap"),
            normalMap: program.getSampler("normalMap"),
            occlusionMap: program.getSampler("occlusionMap")
        };

        this.#hash = this.getHash();
    }

    #buildShader() {
        return {
            vertex: this.buildVertexShader(),
            fragment: this.buildFragmentShader()
        };
    }

    /**
     * Generates vertex shader GLSL for the current View state
     */
    protected abstract buildVertexShader(): string;

    /**
     * Generates fragment shader GLSL for the current View state
     */
    protected abstract buildFragmentShader(): string;

    /**
     * Gets a hash for the View's current configuration as pertaining to the LayerRenderer.
     */
    protected abstract getHash(): string;

    /**
     * Indicates that the LayerRenderer may need to rebuild shaders
     */
    needRebuild() {
        this.#needRebuild = true;
    }

    /**
     * Gets if this LayerRenderer's configuration is still valid for the current View state.
     */
    #getValid() {
        if (!this.#needRebuild) {
            return true;
        }
        this.#needRebuild = false;
        return this.#hash === this.getHash();
    };

    /**
     * Draws the given Layer.
     *
     * @param layer The Layer to draw
     */
    draw(layer: Layer) {

        if (this.#program && !this.#getValid()) {
            this.#program.destroy();
            this.#program = null;
        }

        if (!this.#program) {
            this.#build();
            if (this.errors) {
                return;
            }
            this.renderContext.lastProgramId = -1;
        }

        const renderState = layer.renderState;
        const program = this.#program;
        const renderContext = this.renderContext;
        const renderPass = renderContext.renderPass;
        const gl = this.renderContext.gl;
        const view = this.renderContext.view;
        const uniforms = this.#uniforms;
        const samplers = this.#samplers;

        // @ts-ignore
        if (renderContext.lastProgramId !== program.id) {
            // @ts-ignore
            renderContext.lastProgramId = program.id;
            this.#bind();
        }

        if (uniforms.renderPass) {
            gl.uniform1i(uniforms.renderPass, renderPass);
        }

        // if (uniforms.viewMatrix) {
        //     //gl.uniformMatrix4fv(uniforms.viewMatrix, false, <Float32Array | GLfloat[]>layer.rtcViewMat.viewMatrix);
        //     gl.uniformMatrix4fv(uniforms.viewMatrix, false, <Float32Array | GLfloat[]>view.camera.viewMatrix);
        // }

        if (uniforms.projMatrix) {
            gl.uniformMatrix4fv(uniforms.projMatrix, false, <Float32Array | GLfloat[]>view.camera.projMatrix);
        }

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
        //     const origin = layer.renderState.origin;
        //     const sectionPlanes = view.sectionPlanesList;
        //     const baseIndex = layer.layerIndex * numSectionPlanes;
        //     const drawFlags = rendererModel.drawFlags;
        //     for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
        //         const sectionPlaneUniforms = this.#uniforms.sectionPlanes[sectionPlaneIndex];
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

        if (samplers.viewMatrices) {
            // @ts-ignore
            renderState.dataTextureSet.viewMatrices.bindTexture(program, samplers.viewMatrices, renderContext.nextTextureUnit);
        }
        if (samplers.positions) {
            // @ts-ignore
            renderState.dataTextureSet.positions.bindTexture(program, samplers.positions, renderContext.nextTextureUnit);
        }
        if (samplers.eachMeshMatrices) {
            // @ts-ignore
            renderState.dataTextureSet.eachMeshMatrices.bindTexture(program, samplers.eachMeshMatrices, renderContext.nextTextureUnit);
        }
        if (samplers.eachMeshAttributes) {
            // @ts-ignore
            renderState.dataTextureSet.eachMeshAttributes.bindTexture(program, samplers.eachMeshAttributes, renderContext.nextTextureUnit);
        }
        if (samplers.eachPrimitiveMesh) {
            if (renderState.numIndices8Bits > 0) {
                // @ts-ignore
                renderState.dataTextureSet.eachPrimitiveMesh_8Bits.bindTexture(program, samplers.eachPrimitiveMesh, renderContext.nextTextureUnit);
                // @ts-ignore
                renderState.dataTextureSet.indices_8Bits.bindTexture(program, samplers.indices, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices8Bits);
            }
            if (renderState.numIndices16Bits > 0) {
                // @ts-ignore
                renderState.dataTextureSet.eachPrimitiveMesh_16Bits.bindTexture(program, samplers.eachPrimitiveMesh, renderContext.nextTextureUnit);
                // @ts-ignore
                renderState.dataTextureSet.indices_16Bits.bindTexture(program, samplers.indices, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices16Bits);
            }
            if (renderState.numIndices32Bits > 0) {
                // @ts-ignore
                renderState.dataTextureSet.eachPrimitiveMesh_32Bits.bindTexture(program, samplers.eachPrimitiveMesh, renderContext.nextTextureUnit);
                // @ts-ignore
                renderState.dataTextureSet.indices_32Bits.bindTexture(program, samplers.indices, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices32Bits);
            }
        }
        if (samplers.baseColorMap) {
            samplers.baseColorMap.bindTexture(renderState.materialTextureSet.colorTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.metallicRoughMap) {
            samplers.metallicRoughMap.bindTexture(renderState.materialTextureSet.metallicRoughnessTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.emissiveMap) {
            samplers.emissiveMap.bindTexture(renderState.materialTextureSet.emissiveTexture.texture2D, renderContext.nextTextureUnit);
        }
        if (samplers.occlusionMap) {
            samplers.occlusionMap.bindTexture(renderState.materialTextureSet.occlusionTexture.texture2D, renderContext.nextTextureUnit);
        }
    }

    #bind() {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.#uniforms;
        const project = view.camera.project;

        // @ts-ignore
        this.#program.bind();
        // if (this.#uProjMatrix) {
        //     gl.uniformMatrix4fv(this.#uProjMatrix, false, project.matrix);
        // }
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
                // program.bindTexture(this.#uOcclusionTexture, renderContext.occlusionTexture, 0);
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
            const logDepthBufFC = 2.0 / (Math.log((project as PerspectiveProjection).far + 1.0) / Math.LN2);
            gl.uniform1f(uniforms.logDepthBufFC, logDepthBufFC);
        }
    }

    // protected get vertexShader(): string {
    //     return `${this.vertHeader}
    //     ${this.vertDataTextureDefs}
    //     ${this.vertLogDepthBufDefs}
    //     void main(void) {
    //             ${this.vertDataTextureSamples}
    //             ${this.vertLogDepthBufOutputs}
    //     }`;
    // }

    protected get vertHeader(): string {
        return `#version 300 es
                #ifdef GL_FRAGMENT_PRECISION_HIGH
                precision highp float;
                precision highp int;
                precision highp usampler2D;
                precision highp isampler2D;
                precision highp sampler2D;
                #else
                precision mediump float;
                precision mediump int;
                precision mediump usampler2D;
                precision mediump isampler2D;
                precision mediump sampler2D;
                uniform int renderPass;
                #endif`;
    }

    protected get vertDataTextureDefs(): string {
        return `uniform mediump sampler2D eachMeshMatrices;
                uniform lowp usampler2D eachMeshAttributes;
                uniform highp sampler2D eachMeshOffset;
                uniform mediump usampler2D positions;
                uniform highp usampler2D indices;
                uniform mediump usampler2D eachPrimitiveMesh;
                uniform highp sampler2D cameraMatrices;
                uniform highp sampler2D sceneModelRendererMatrices;`;
    }

    protected get vertLogDepthBufDefs(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `uniform float logDepthBufFC;
                    out float fragDepth;
                    bool isPerspectiveMatrix(mat4 m) {
                        return (m[2][3] == - 1.0);
                    }
                    out float isPerspective;`;
        } else {
            return ""
        }
    }

    protected get vertDataTextureSamples(): string {
        return "";
    }

    protected get vertLogDepthBufOutputs(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `fragDepth = 1.0 + clipPos.w;
                    isPerspective = float (isPerspectiveMatrix(projMatrix));`;
        } else {
            return ""
        }
    }

    protected get fragmentShader(): string {
        return `${this.fragHeader}
        ${this.fragGammaDefs}
        ${this.fragSectionPlaneDefs}
        ${this.fragLightDefs}
        ${this.fragLogDepthBufDefs}
        void main(void) {
            ${this.fragSectionPlanesSlice}
            ${this.fragLighting}
            ${this.fragLogDepthBufOutput}
        }`;
    }

    protected get fragHeader(): string {
        return `#version 300 es
        #ifdef GL_FRAGMENT_PRECISION_HIGH
       precision highp float;
        precision highp int;
        #else
        precision mediump float;
        precision mediump int;
        #endif`;
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

    protected get fragLightDefs(): string {
        const view = this.renderContext.view;
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

    protected get fragLogDepthBufDefs(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return `in float isPerspective;
                    uniform float logDepthBufFC;
                    in float fragDepth;`;
        } else {
            return ""
        }
    }

    protected get fragLogDepthBufOutput(): string {
        if (this.renderContext.view.logarithmicDepthBufferEnabled) {
            return "gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( fragDepth ) * logDepthBufFC * 0.5;";
        } else {
            return ""
        }
    }

    protected get fragLighting(): string {
        const src = [];
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vec4 modelNormal = vec4(octDecode(normal.xy), 0.0); ");
        src.push("vec4 worldNormal = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        src.push("vec3 viewNormal = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
        src.push("float lambertian = 1.0;");

        for (let i = 0, len = this.renderContext.view.lightsList.length; i < len; i++) {
            const light: any = this.renderContext.view.lightsList[i];
            if (light.type === "ambient") {
                continue;
            }
            if (light.type === "dir") {
                if (light.space === "view") {
                    src.push("viewLightDir = normalize(lightDir" + i + ");");
                } else {
                    src.push("viewLightDir = normalize((viewMatrix * vec4(lightDir" + i + ", 0.0)).xyz);");
                }
            } else if (light.type === "point") {
                if (light.space === "view") {
                    src.push("viewLightDir = -normalize(lightPos" + i + " - viewPosition.xyz);");
                } else {
                    src.push("viewLightDir = -normalize((viewMatrix * vec4(lightPos" + i + ", 0.0)).xyz);");
                }
            } else if (light.type === "spot") {
                if (light.space === "view") {
                    src.push("viewLightDir = normalize(lightDir" + i + ");");
                } else {
                    src.push("viewLightDir = normalize((viewMatrix * vec4(lightDir" + i + ", 0.0)).xyz);");
                }
            } else {
                continue;
            }
            src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
            src.push("reflectedColor += lambertian * (lightColor" + i + ".rgb * lightColor" + i + ".a);");
        }
        src.push("vec3 rgb = (vec3(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0));");
        src.push("meshColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");

        return src.join("\n");
    }

    protected get fragSAOOutput(): string {
        if (this.renderContext.view.sao.enabled) {
            // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
            // Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
            return `float viewportWidth     = uSAOParams[0];
                    float viewportHeight    = uSAOParams[1];
                    float blendCutoff       = uSAOParams[2];
                    float blendFactor       = uSAOParams[3];
                    vec2 uv                 = vec2(gl_FragCoord.x / viewportWidth, gl_FragCoord.y / viewportHeight);
                    float ambient           = smoothstep(blendCutoff, 1.0, unpackRGBToFloat(texture(uOcclusionTexture, uv))) * blendFactor;
                    outColor                = vec4(fragColor.rgb * ambient, 1.0);`;
        } else {
            return `outColor            = fragColor;`;
        }
    }

    protected get fragOutput(): string {
        return `outColor            = fragColor;`;
    }


    protected get fragSectionPlaneDefs(): string {
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

    protected get fragLightSourceUniforms(): string {
        const src = [];
        src.push(`uniform vec4 lightAmbient;`);
        for (let i = 0, len = this.renderContext.view.lightsList.length; i < len; i++) {
            const light = this.renderContext.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            src.push(`uniform vec4 lightColor${i};`);
            if (light instanceof DirLight) {
                src.push(`uniform vec3 lightDir${i};`);
            }
            if (light instanceof PointLight) {
                src.push(`uniform vec3 lightPos${i};`);
            }
        }
        return src.join("\n");
    }

    protected get fragSectionPlanesSlice(): string {
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

    protected get fragFlatShading(): string {
        const src = [];
        src.push("");
        return src.join("\n");
    }

    destroy() {
        if (this.#program) {
            this.#program.destroy();
        }
        this.#program = null;
    }
}
