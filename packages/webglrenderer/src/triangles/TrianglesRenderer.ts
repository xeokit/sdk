import {createVec4} from "@xeokit/matrix";
import {OrthoProjectionType} from "@xeokit/constants";
import {AmbientLight, DirLight, PerspectiveProjection, PointLight} from "@xeokit/viewer";

import type {RenderContext} from "../RenderContext";
import {RENDER_PASSES} from "../RENDER_PASSES";
import type {TrianglesLayer} from "./TrianglesLayer";
import {WebGLProgram, WebGLSampler} from "@xeokit/webglutils";
import {LayerRenderer} from "../LayerRenderer";

const tempVec4 = createVec4();

/**
 * @private
 */
export abstract class TrianglesRenderer extends LayerRenderer {

    /**
     * Initialization error messages
     */
    errors: string[] | undefined;

    #hash: string;
    #program: WebGLProgram | null;
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
        viewMatrices: WebGLSampler;
        positionsCompressedDataTexture: WebGLSampler;
        indicesDataTexture: WebGLSampler;
        edgeIndices: WebGLSampler;
        perSubMeshInstancingMatricesDataTexture: WebGLSampler;
        perSubMeshAttributesDataTexture: WebGLSampler;
        //    eachMeshOffsets: WebGLSampler;
        eachEdgeOffset: WebGLSampler;
        perTriangleSubMeshDataTexture: WebGLSampler;
        eachEdgeMesh: WebGLSampler;
        baseColorMap: WebGLSampler;
        metallicRoughMap: WebGLSampler;
        emissiveMap: WebGLSampler;
        normalMap: WebGLSampler;
        occlusionMap: WebGLSampler;
    };

    protected constructor(renderContext: RenderContext) {
        super(renderContext);

        this.#needRebuild = true;
        this.#build();
    }

    #build(): void {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;

        this.#program = new WebGLProgram(gl, this.#buildShader());

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
            positionsCompressedDataTexture: program.getSampler("positionsCompressedDataTexture"),
            indicesDataTexture: program.getSampler("indicesDataTexture"),
            edgeIndices: program.getSampler("edgeIndices"),
            perSubMeshAttributesDataTexture: program.getSampler("perSubMeshAttributesDataTexture"),
            perSubMeshInstancingMatricesDataTexture: program.getSampler("perSubMeshInstancingMatricesDataTexture"),
            eachEdgeOffset: program.getSampler("perSubmeshOffsetDataTexture"),
            perTriangleSubMeshDataTexture: program.getSampler("eachMeshTriangleMesh"),
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
     * Indicates that the TrianglesRenderer may need to rebuild shaders
     */
    needRebuild() {
        this.#needRebuild = true;
    }

    /**
     * Gets if this TrianglesRenderer's configuration is still valid for the current View state.
     */
    #getValid() {
        if (!this.#needRebuild) {
            return true;
        }
        this.#needRebuild = false;
        return this.#hash === this.getHash();
    };

    /**
     * Draws the given TrianglesLayer.
     *
     * @param trianglesLayer The TrianglesLayer to draw
     */
    drawTriangles(trianglesLayer: TrianglesLayer) {

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

        const renderState = trianglesLayer.renderState;
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
        //     //gl.uniformMatrix4fv(uniforms.viewMatrix, false, <Float32Array | GLfloat[]>trianglesLayer.rtcViewMat.viewMatrix);
        //     gl.uniformMatrix4fv(uniforms.viewMatrix, false, <Float32Array | GLfloat[]>view.camera.viewMatrix);
        // }

        if (uniforms.projMatrix) {
            gl.uniformMatrix4fv(uniforms.projMatrix, false, <Float32Array | GLfloat[]>view.camera.projMatrix);
        }

        if (uniforms.worldMatrix) {
            gl.uniformMatrix4fv(uniforms.worldMatrix, false, <Float32Array | GLfloat[]>trianglesLayer.rendererModel.worldMatrix);
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

        // if (samplers.viewMatrices) {
        //     renderState.dataTextureSet.viewMatrices.bindTexture(program, samplers.viewMatrices, renderContext.nextTextureUnit);
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
        if (samplers.perTriangleSubMeshDataTexture) {
            if (renderState.numIndices8Bits > 0) {
                renderState.dataTextureSet.perTriangleSubMesh8BitsDataTexture.bindTexture(program, samplers.perTriangleSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices8BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices8Bits);
            }
            if (renderState.numIndices16Bits > 0) {
                renderState.dataTextureSet.perTriangleSubMesh16BitsDataTexture.bindTexture(program, samplers.perTriangleSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices16BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices16Bits);
            }
            if (renderState.numIndices32Bits > 0) {
                renderState.dataTextureSet.perTriangleSubMesh32BitsDataTexture.bindTexture(program, samplers.perTriangleSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices32BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices32Bits);
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

    #bind() {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.#uniforms;
        const projection = view.camera.projection;

        // @ts-ignore
        this.#program.bind();
        // if (this.#uProjMatrix) {
        //     gl.uniformMatrix4fv(this.#uProjMatrix, false, projection.matrix);
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
            const logDepthBufFC = 2.0 / (Math.log((projection as PerspectiveProjection).far + 1.0) / Math.LN2);
            gl.uniform1f(uniforms.logDepthBufFC, logDepthBufFC);
        }
    }

    protected get vertLightingDefs(): string {
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
        src.push("out vec4 vColor;");
        return src.join("\n");
    }

    protected get vertLighting(): string {
        const src = [];
        src.push("vec4      viewPosition    = viewMatrix * worldPosition; ");
        src.push("vec4      modelNormal     = vec4(octDecode(normal.xy), 0.0); ");
        src.push("vec4      worldNormal     = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        src.push("vec3      viewNormal      = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3      reflectedColor  = vec3(0.0, 0.0, 0.0);");
        src.push("vec3      viewLightDir    = vec3(0.0, 0.0, -1.0);");
        src.push("float     lambertian      = 1.0;");

        for (let i = 0, len = this.renderContext.view.lightsList.length; i < len; i++) {
            const light: any = this.renderContext.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            if (light instanceof DirLight) {
                src.push(`viewLightDir = normalize((viewMatrix * vec4(lightDir${i}, 0.0)).xyz);`);
            }
            if (light instanceof PointLight) {
                src.push(`viewLightDir = -normalize((viewMatrix * vec4(lightPos${i}, 0.0)).xyz);`);
            }
            src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
            src.push("reflectedColor += lambertian * (lightColor" + i + ".rgb * lightColor" + i + ".a);");
        }
        src.push("vec3 rgb = (vec3(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0));");
        src.push("vColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");
        return src.join("\n");
    }

    protected get vertTrianglesDataTextureDefs(): string {
        return `uniform mediump usampler2D  perTriangleSubMeshDataTexture;                
                uniform lowp    usampler2D  perSubMeshAttributesDataTexture; 
                uniform mediump sampler2D   perSubMeshInstancingMatricesDataTexture; 
                uniform mediump sampler2D   perSubMeshDecodeMatricesDataTexture;                
                uniform highp   sampler2D   perSubmeshOffsetDataTexture;                           
                uniform mediump usampler2D  positionsCompressedDataTexture; 
                uniform highp   usampler2D  indicesDataTexture; 
                uniform highp   usampler2D  edgeIndicesDataTexture;`;
    }

    protected get vertTriangleVertexPosition() {
        return `int     polygonIndex                = gl_VertexID / 3;
                int     h_packed_object_id_index    = (polygonIndex >> 3) & 4095;
                int     v_packed_object_id_index    = (polygonIndex >> 3) >> 12;
                int     objectIndex                 = int(texelFetch(perTriangleSubMeshDataTexture, ivec2(h_packed_object_id_index, v_packed_object_id_index), 0).r);
                ivec2   objectIndexCoords           = ivec2(objectIndex % 512, objectIndex / 512);
                uvec4   flags                       = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+2, objectIndexCoords.y), 0);
                uvec4   flags2                      = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+3, objectIndexCoords.y), 0);
                if (int(flags.z) != renderPass) {               
                    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                    return;
                } 
                ivec4   packedVertexBase                = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+4, objectIndexCoords.y), 0));
                ivec4   packedIndexBaseOffset           = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+5, objectIndexCoords.y), 0));
                int     indexBaseOffset                 = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;
                int     h_index                         = (polygonIndex - indexBaseOffset) & 4095;
                int     v_index                         = (polygonIndex - indexBaseOffset) >> 12;
                ivec3   vertexIndices                   = ivec3(texelFetch(indicesDataTexture, ivec2(h_index, v_index), 0));
                ivec3   uniqueVertexIndexes             = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;
                ivec3   indexPositionH                  = uniqueVertexIndexes & 4095;
                ivec3   indexPositionV                  = uniqueVertexIndexes >> 12;
                mat4    objectInstanceMatrix            = mat4 (texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
                mat4    objectDecodeAndInstanceMatrix   = objectInstanceMatrix * mat4 (texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
                uint    solid                           = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+7, objectIndexCoords.y), 0).r;
                        positions[0]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.r, indexPositionV.r), 0));
                        positions[1]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.g, indexPositionV.g), 0));
                        positions[2]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.b, indexPositionV.b), 0));
                vec3    normal                          = normalize(cross(positions[2] - positions[0], positions[1] - positions[0]));
                vec3    position                        = positions[gl_VertexID % 3];
                vec3    viewNormal                      = -normalize((transpose(inverse(viewMatrix * objectDecodeAndInstanceMatrix)) * vec4(normal,1)).xyz);
                if (solid != 1u) {
                    if (isPerspectiveMatrix(projMatrix)) {
                        vec3 uCameraEyeRtcInQuantizedSpace = (inverse(sceneModelMatrix * objectDecodeAndInstanceMatrix) * vec4(uCameraEyeRtc, 1)).xyz;
                        if (dot(position.xyz - uCameraEyeRtcInQuantizedSpace, normal) < 0.0) {
                            position = positions[2 - (gl_VertexID % 3)];
                            viewNormal = -viewNormal;
                        }
                    } else {
                        if (viewNormal.z < 0.0) {
                            position = positions[2 - (gl_VertexID % 3)];
                            viewNormal = -viewNormal;
                        }
                    }
               }
               vec4 worldPosition = sceneModelMatrix *  (objectDecodeAndInstanceMatrix * vec4(position, 1.0));
               vec4 viewPosition = viewMatrix * worldPosition;
               vec4 clipPos = projMatrix * viewPosition;
               gl_Position = clipPos;`;
    }

    //----------------------------------------------------------------------------------------
    // Fragment shader
    //----------------------------------------------------------------------------------------

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

    protected get fragLightingDefs(): string {
        return `in vec4 vColor;
                out vec4 outColor;`;
    }

    protected get fragColorDefs(): string {
        return `uniform vec4 color;
                out vec4 outColor;`;
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

    protected get fragLighting(): string {
        return `outColor = vColor;`;
    }

    protected get fragColor(): string {
        return `outColor = color;`;
    }

    destroy() {
        if (this.#program) {
            this.#program.destroy();
        }
        this.#program = null;
    }
}
