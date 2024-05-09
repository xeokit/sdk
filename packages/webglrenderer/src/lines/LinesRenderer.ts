import {createVec4} from "@xeokit/matrix";
import {OrthoProjectionType} from "@xeokit/constants";
import {AmbientLight, DirLight, PerspectiveProjection, PointLight} from "@xeokit/viewer";

import type {RenderContext} from "../RenderContext";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {WebGLProgram, WebGLSampler} from "@xeokit/webglutils";
import {DTXLayerRenderer} from "../LayerRenderer";

const tempVec4 = createVec4();

/**
 * @private
 */
export abstract class LinesRenderer extends DTXLayerRenderer {

    /**
     * Initialization error messages
     */
    declare errors: string[] | undefined;

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
        subMeshInstanceMatricesDataTexture: WebGLSampler;
        subMeshAttributesDataTexture: WebGLSampler;
        //    eachMeshOffsets: WebGLSampler;
        eachEdgeOffset: WebGLSampler;
        primitiveToSubMeshLookupDataTexture: WebGLSampler;
        eachEdgeMesh: WebGLSampler;
        baseColorMap: WebGLSampler;
        metallicRoughMap: WebGLSampler;
        emissiveMap: WebGLSampler;
        normalMap: WebGLSampler;
        occlusionMap: WebGLSampler;
    };

    // protected constructor(renderContext: RenderContext) {
    //     super(renderContext);
    //
    //     this.#needRebuild = true;
    //     this.#build();
    // }

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
            subMeshAttributesDataTexture: program.getSampler("subMeshAttributesDataTexture"),
            subMeshInstanceMatricesDataTexture: program.getSampler("subMeshInstanceMatricesDataTexture"),
            eachEdgeOffset: program.getSampler("subMeshOffsetsDataTexture"),
            primitiveToSubMeshLookupDataTexture: program.getSampler("eachMeshTriangleMesh"),
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



    protected get vertTrianglesLightingDefs(): string {
        const view = this.view;
        const src = [];
        src.push("uniform vec4 lightAmbient;");
        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light = view.lightsList[i];
            if (light instanceof AmbientLight) {

            }
            if (light instanceof DirLight) {
                src.push(`uniform vec4 lightColor${i}`);
                src.push(`uniform vec4 lightDir${i}`);
            }
        }
        return src.join("\n");
    }

    protected get vertDataTextureDefs(): string {
        return `uniform mediump usampler2D  primitiveToSubMeshLookupDataTexture;

                uniform lowp    usampler2D  subMeshAttributesDataTexture;
                uniform mediump sampler2D   subMeshInstanceMatricesDataTexture;
                uniform mediump sampler2D   subMeshDecompressMatricesDataTexture;
                uniform highp   sampler2D   subMeshOffsetsDataTexture;

                uniform mediump usampler2D  positionsCompressedDataTexture;
                uniform highp   usampler2D  indicesDataTexture;
                uniform highp   usampler2D  edgeIndicesDataTexture;`;
    }
    //
    // protected get vertLinesVertexPosition() {
    //     return `int     polygonIndex                = gl_VertexID / 2;
    //             int     h_packed_object_id_index    = (polygonIndex >> 3) & 4095;
    //             int     v_packed_object_id_index    = (polygonIndex >> 3) >> 12;
    //             int     objectIndex                 = int(texelFetch(primitiveToSubMeshLookupDataTexture, ivec2(h_packed_object_id_index, v_packed_object_id_index), 0).r);
    //             ivec2   objectIndexCoords           = ivec2(objectIndex % 512, objectIndex / 512);
    //             uvec4   flags                       = texelFetch (subMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+2, objectIndexCoords.y), 0);
    //             uvec4   flags2                      = texelFetch (subMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+3, objectIndexCoords.y), 0);
    //             if (int(flags.z) != renderPass) {
    //                 gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
    //                 return;
    //             }
    //             ivec4   packedVertexBase                = ivec4(texelFetch (subMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+4, objectIndexCoords.y), 0));
    //             ivec4   packedEdgeIndexBaseOffset       = ivec4(texelFetch (subMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+6, objectIndexCoords.y), 0));
    //             int     edgeIndexBaseOffset             = (packedEdgeIndexBaseOffset.r << 24) + (packedEdgeIndexBaseOffset.g << 16) + (packedEdgeIndexBaseOffset.b << 8) + packedEdgeIndexBaseOffset.a;
    //             int     h_index                         = (polygonIndex - edgeIndexBaseOffset) & 4095;
    //             int     v_index                         = (polygonIndex - edgeIndexBaseOffset) >> 12;
    //             ivec3   vertexIndices                   = ivec3(texelFetch(edgeIndicesDataTexture, ivec2(h_index, v_index), 0));
    //             ivec3   uniqueVertexIndexes             = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;
    //             ivec3   indexPositionH                  = uniqueVertexIndexes & 4095;
    //             ivec3   indexPositionV                  = uniqueVertexIndexes >> 12;
    //             mat4    objectInstanceMatrix            = mat4 (texelFetch (subMeshInstanceMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
    //             mat4    objectDecodeAndInstanceMatrix   = objectInstanceMatrix * mat4 (texelFetch (subMeshDecompressMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
    //             vec3    position                        = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH, indexPositionV), 0));
    //             vec4    worldPosition = sceneModelMatrix *  (objectDecodeAndInstanceMatrix * vec4(position, 1.0));
    //             vec4    viewPosition = viewMatrix * worldPosition;
    //             vec4    clipPos = projMatrix * viewPosition;
    //                     gl_Position = clipPos;`;
    // }

    //----------------------------------------------------------------------------------------
    // Fragment shader
    //----------------------------------------------------------------------------------------

    protected get fragmentShader(): string {
        return `${this.fragHeader}
        ${this.fragGammaDefs}
        ${this.fragSlicingDefs}
        ${this.fragLightDefs}
        ${this.fragLogDepthBufDefs}
        void main(void) {
            ${this.fragSlicing}
            ${this.fragTrianglesLighting}
            ${this.fragLogDepthBuf}
        }`;
    }

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

    protected get fragLightDefs(): string {
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

    protected get fragTrianglesLighting(): string {
        const src = [];
        src.push("vec4 viewPosition = viewMatrix * worldPosition; ");
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


    protected get fragTrianglesFlatShading(): string {
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
