import {math, View, Perspective, AmbientLight, DirLight, PointLight} from "../../viewer/index";
import {FrameContext} from "../FrameContext";

import {RENDER_PASSES} from "../WebGLSceneModel/RENDER_PASSES";
import {Program} from "../lib/Program";
import {Sampler} from "../lib/Sampler";
import {Layer} from "../WebGLSceneModel/Layer";

const tempVec4 = math.vec4();
const tempVec3a = math.vec3();

/**
 * @private
 */
export abstract class LayerRenderer {

    /**
     * Initialization error messages
     */
    errors: string[];

    #view: View;
    #hash: string;
    #program: Program;
    #gl: WebGL2RenderingContext;

    #uniforms: {
        renderPass: WebGLUniformLocation;
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
        cameraMatrices: Sampler;
        sceneModelMatrices: Sampler;
        positions: Sampler;
        indices: Sampler;
        edgeIndices: Sampler;
        eachMeshMatrices: Sampler;
        eachMeshAttributes: Sampler;
        eachMeshOffsets: Sampler;
        eachEdgeOffset: Sampler;
        eachTriangleMesh: Sampler;
        eachEdgeMesh: Sampler;
        baseColorMap: Sampler;
        metallicRoughMap: Sampler;
        emissiveMap: Sampler;
        normalMap: Sampler;
        occlusionMap: Sampler;
    };

    #vertShaderParts = {
        header:  
            `#version 300 es
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
        
             uniform int renderPass;`,
        
        gammaFuncs:
            `uniform float gammaFactor;
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
             }`
    };

    constructor(view: View, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
        this.#build();
    }

    #build(): void {

        const view = this.#view;
        const gl = this.#gl;

        this.#program = new Program(gl, this.#buildShader());

        if (this.#program.errors) {
            this.errors = this.#program.errors;
            return;
        }

        const program = this.#program;
        const uniforms = this.#uniforms;
        const samplers = this.#samplers;

        uniforms.renderPass = program.getLocation("renderPass");
        uniforms.sao = program.getLocation("sao");
        uniforms.logDepthBufFC = program.getLocation("logDepthBufFC");
        uniforms.gammaFactor = program.getLocation("gammaFactor");
        uniforms.pointSize = program.getLocation("pointSize");
        uniforms.nearPlaneHeight = program.getLocation("nearPlaneHeight");
        uniforms.pointCloudIntensityRange = program.getLocation("pointCloudIntensityRange");
        uniforms.pickZNear = program.getLocation("pickZNear");
        uniforms.pickZFar = program.getLocation("pickZFar");
        uniforms.pickInvisible = program.getLocation("pickInvisible");
        uniforms.color = program.getLocation("color");
        uniforms.lightAmbient = program.getLocation("lightAmbient");

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

        uniforms.sectionPlanes = [];
        for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
            uniforms.sectionPlanes.push({
                active: program.getLocation("sectionPlaneActive" + i),
                pos: program.getLocation("sectionPlanePos" + i),
                dir: program.getLocation("sectionPlaneDir" + i)
            });
        }

        samplers.cameraMatrices = program.getSampler("cameraMatrices");
        samplers.sceneModelMatrices = program.getSampler("sceneModelMatrices");
        samplers.positions = program.getSampler("positions");
        samplers.indices = program.getSampler("indices");
        samplers.edgeIndices = program.getSampler("edgeIndices");
        samplers.eachMeshAttributes = program.getSampler("eachMeshAttributes");
        samplers.eachMeshMatrices = program.getSampler("eachMeshMatrices");
        samplers.eachEdgeOffset = program.getSampler("eachMeshOffset");
        samplers.eachTriangleMesh = program.getSampler("eachMeshTriangleMesh");
        samplers.eachEdgeMesh = program.getSampler("eachEdgeMesh");
        samplers.baseColorMap = program.getSampler("baseColorMap");
        samplers.metallicRoughMap = program.getSampler("metallicRoughMap");
        samplers.emissiveMap = program.getSampler("emissiveMap");
        samplers.normalMap = program.getSampler("normalMap");
        samplers.occlusionMap = program.getSampler("occlusionMap");

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
     * @protected
     */
    protected abstract buildVertexShader(): string;

    /**
     * Generates fragment shader GLSL for the current View state
     * @protected
     */
    protected abstract buildFragmentShader(): string;

    /**
     * Gets a hash for the LayerRenderer's current configuration.
     * @protected
     */
    protected abstract getHash(): string;

    /**
     * Gets if this LayerRenderer's configuration is still valid for the current View state.
     */
    #getValid() {
        return this.#hash === this.getHash();
    };

    /**
     * Draws the given Layer within the given render pass.
     *
     * @param frameContext Renderer state that varies throughout each frame.
     * @param layer The Layer to draw
     * @param renderPass Indicates which render pass to render
     */
    draw(frameContext: FrameContext, layer: Layer, renderPass: number) {

        if (this.#program && !this.#getValid()) {
            this.#program.destroy();
            this.#program = null;
        }

        if (!this.#program) {
            this.#build();
            if (this.errors) {
                return;
            }
            frameContext.lastProgramId = null;
        }

        const gl = this.#gl;
        const view = this.#view;
        const uniforms = this.#uniforms;
        const samplers = this.#samplers;
        const sceneModel = layer.sceneModel;
        const state = layer.state;
        const program = this.#program;

        if (frameContext.lastProgramId !== program.id) {
            frameContext.lastProgramId = program.id;
            this.#bind(frameContext);
        }

        if (uniforms.renderPass) {
            gl.uniform1i(uniforms.renderPass, renderPass);
        }

        if (uniforms.color) {
            if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
                const material = view.xrayMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
                const material = view.highlightMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
                const material = view.selectedMaterial.state;
                const fillColor = material.fillColor;
                const fillAlpha = material.fillAlpha;
                gl.uniform4f(uniforms.color, fillColor[0], fillColor[1], fillColor[2], fillAlpha);
            } else {
                gl.uniform4fv(uniforms.color, math.vec3([1, 1, 1]));
            }
        }

        if (view.sectionPlanesList.length) {
            const numSectionPlanes = view.sectionPlanesList.length;
            const origin = layer.state.origin;
            const sectionPlanes = view.sectionPlanesList;
            const baseIndex = layer.layerIndex * numSectionPlanes;
            const drawFlags = sceneModel.drawFlags;
            for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
                const sectionPlaneUniforms = this.#uniforms.sectionPlanes[sectionPlaneIndex];
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

        if (samplers.cameraMatrices) {
            state.dataTextureSet.cameraMatrices.bindTexture(program, samplers.cameraMatrices, frameContext.nextTextureUnit);
        }
        if (samplers.sceneModelMatrices) {
            state.dataTextureSet.sceneModelMatrices.bindTexture(program, samplers.sceneModelMatrices, frameContext.nextTextureUnit);
        }
        if (samplers.positions) {
            state.dataTextureSet.positions.bindTexture(program, samplers.positions, frameContext.nextTextureUnit);
        }
        if (samplers.eachMeshMatrices) {
            state.dataTextureSet.eachMeshMatrices.bindTexture(program, samplers.eachMeshMatrices, frameContext.nextTextureUnit);
        }
        if (samplers.eachMeshAttributes) {
            state.dataTextureSet.eachMeshAttributes.bindTexture(program, samplers.eachMeshAttributes, frameContext.nextTextureUnit);
        }
        if (samplers.eachMeshOffsets) {
            state.dataTextureSet.eachEdgeOffset.bindTexture(program, samplers.eachMeshOffsets, frameContext.nextTextureUnit);
        }
        if (samplers.eachTriangleMesh) {
            if (state.numIndices8Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_8Bits.bindTexture(program, samplers.eachTriangleMesh, frameContext.nextTextureUnit);
                state.dataTextureSet.indices_8Bits.bindTexture(program, samplers.indices, frameContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices8Bits);
            }
            if (state.numIndices16Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_16Bits.bindTexture(program, samplers.eachTriangleMesh, frameContext.nextTextureUnit);
                state.dataTextureSet.indices_16Bits.bindTexture(program, samplers.indices, frameContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices16Bits);
            }
            if (state.numIndices32Bits > 0) {
                state.dataTextureSet.eachTriangleMesh_32Bits.bindTexture(program, samplers.eachTriangleMesh, frameContext.nextTextureUnit);
                state.dataTextureSet.indices_32Bits.bindTexture(program, samplers.indices, frameContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, state.numIndices32Bits);
            }
        }
        if (samplers.baseColorMap) {
            samplers.baseColorMap.bindTexture(state.materialTextureSet.colorTexture.texture, frameContext.nextTextureUnit);
        }
        if (samplers.metallicRoughMap) {
            samplers.metallicRoughMap.bindTexture(state.materialTextureSet.metallicRoughnessTexture.texture, frameContext.nextTextureUnit);
        }
        if (samplers.emissiveMap) {
            samplers.emissiveMap.bindTexture(state.materialTextureSet.emissiveTexture.texture, frameContext.nextTextureUnit);
        }
        if (samplers.normalMap) {
            samplers.normalMap.bindTexture(state.materialTextureSet.normalsTexture.texture, frameContext.nextTextureUnit);
        }
        if (samplers.occlusionMap) {
            samplers.occlusionMap.bindTexture(state.materialTextureSet.occlusionTexture.texture, frameContext.nextTextureUnit);
        }
    }

    /**
     * Binds this renderer and loads global state, eg. lights, ambient shadows, environment maps etc.
     *
     * @param frameContext
     * @private
     */
    #bind(frameContext: FrameContext) {

        const view = this.#view;
        const gl = this.#gl;
        const uniforms = this.#uniforms;
        const project = view.camera.project;
        this.#program.bind();

        // if (this.#uProjMatrix) {
        //     gl.uniformMatrix4fv(this.#uProjMatrix, false, project.matrix);
        // }

        if (uniforms.lightAmbient) {
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
                gl.uniform4fv(uniforms.sao, tempVec4);
                // program.bindTexture(this.#uOcclusionTexture, frameContext.occlusionTexture, 0);
            }
        }
        if (uniforms.gammaFactor) {
            gl.uniform1f(uniforms.gammaFactor, view.gammaFactor);
        }
        if (uniforms.pointSize) {
            gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
        }
        if (uniforms.nearPlaneHeight) {
            gl.uniform1f(uniforms.nearPlaneHeight, (view.camera.projection === "ortho") ? 1.0 : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspective.fov * Math.PI / 180.0))));
        }
        if (uniforms.pickZNear) {
            gl.uniform1f(uniforms.pickZNear, frameContext.pickZNear);
            gl.uniform1f(uniforms.pickZFar, frameContext.pickZFar);
        }
        if (uniforms.pickInvisible) {
            gl.uniform1i(uniforms.pickInvisible, frameContext.pickInvisible ? 1 : 0);
        }
        if (view.logarithmicDepthBufferEnabled) {
            if (uniforms.logDepthBufFC) {
                const logDepthBufFC = 2.0 / (Math.log((project as Perspective).far + 1.0) / Math.LN2);
                gl.uniform1f(uniforms.logDepthBufFC, logDepthBufFC);
            }
        }
    }

    protected get vertexShader(): string {
        return `
        ${this.vertHeader}
        ${this.vertDeclareDataTextures}
        ${this.vertDeclareLogDepthBuf}
        void main(void) {
                ${this.vertReadDataTextures}
                ${this.vertLogDepthBufLogic}
        }`;
    }

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
        
                uniform int renderPass;`;
    }

    protected get vertDeclareDataTextures(): string {
        return `uniform mediump sampler2D eachMeshMatrices;
                uniform lowp usampler2D eachMeshAttributes;
                uniform highp sampler2D eachMeshOffset;
                uniform mediump usampler2D positions;
                uniform highp usampler2D indices;
                uniform mediump usampler2D eachTriangleMesh;
                uniform highp sampler2D cameraMatrices;
                uniform highp sampler2D sceneModelMatrices;`;
    }

    protected get vertDeclareLogDepthBuf(): string {
        if (this.#view.logarithmicDepthBufferEnabled) {
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

    protected get vertShaderSourceEmphasis(): string {
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
        
                uniform highp   sampler2D   cameraMatrices;
                uniform highp   sampler2D   sceneModelMatrices;
                uniform mediump sampler2D   eachMeshMatrices;
                uniform lowp    usampler2D  eachMeshAttributes;
                uniform highp   sampler2D   eachMeshOffset;
                uniform mediump usampler2D  positions;
                uniform highp   usampler2D  indices;
                uniform mediump usampler2D  eachTriangleMesh;
                
                uniform  float  logDepthBufFC;
                 
                out vec4        worldPosition;
                out int         meshFlags2;                       
                out float       fragDepth;
                
                bool isPerspectiveMatrix(mat4 m) {
                    return (m[2][3] == - 1.0);
                }
                
                out float isPerspective;
                    
                void main(void) {
                                   
                    int triangleIndex      = gl_VertexID / 3;
                    
                    int hPackedMeshIdIndex = (triangleIndex >> 3) & 1023;
                    int vPackedMeshIdIndex = (triangleIndex >> 3) >> 10;
                    
                    int meshIndex          = int(texelFetch(eachTriangleMesh, ivec2(hPackedMeshIdIndex, vPackedMeshIdIndex), 0).r);                   
                    uvec4 meshFlags        = texelFetch (eachMeshAttributes, ivec2(2, meshIndex), 0);

                    if (int(meshFlags.x) != renderPass) {
                        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                        return;
                    } 
                 
                    mat4 viewMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 0), 0), texelFetch (cameraMatrices,     ivec2(1, 0), 0), texelFetch (cameraMatrices,     ivec2(2, 0), 0), texelFetch (cameraMatrices,     ivec2(3, 0), 0));
                    mat4 projMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 2), 0), texelFetch (cameraMatrices,     ivec2(1, 2), 0), texelFetch (cameraMatrices,     ivec2(2, 2), 0), texelFetch (cameraMatrices,     ivec2(3, 2), 0));
                    mat4 worldMatrix = mat4 (texelFetch (sceneModelMatrices, ivec2(0, 0), 0), texelFetch (sceneModelMatrices, ivec2(1, 0), 0), texelFetch (sceneModelMatrices, ivec2(2, 0), 0), texelFetch (sceneModelMatrices, ivec2(3, 0), 0));
                
                    uvec4 meshFlags2 = texelFetch (eachMeshAttributes, ivec2(3, meshIndex), 0);

                    ivec4 packedVertexBase = ivec4(texelFetch (eachMeshAttributes, ivec2(4, meshIndex), 0));
                    ivec4 packedIndexBaseOffset = ivec4(texelFetch (eachMeshAttributes, ivec2(5, meshIndex), 0));
                    int indexBaseOffset = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;

                    int hIndex = (triangleIndex - indexBaseOffset) & 1023;
                    int vIndex = (triangleIndex - indexBaseOffset) >> 10;

                    ivec3 vertexIndices = ivec3(texelFetch(indices, ivec2(hIndex, vIndex), 0));
                    ivec3 uniqueVertexIndexes = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;

                    ivec3 indexPositionH = uniqueVertexIndexes & 1023;
                    ivec3 indexPositionV = uniqueVertexIndexes >> 10;

                    mat4 positionsDecompressMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(0, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(1, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(2, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(3, meshIndex), 0));
                    mat4 meshMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(4, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(5, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(6, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(7, meshIndex), 0));

                    _positions[0] = vec3(texelFetch(positions, ivec2(indexPositionH.r, indexPositionV.r), 0));
                    _positions[1] = vec3(texelFetch(positions, ivec2(indexPositionH.g, indexPositionV.g), 0));
                    _positions[2] = vec3(texelFetch(positions, ivec2(indexPositionH.b, indexPositionV.b), 0));
  
                    vec3  position      = _positions[gl_VertexID % 3];
                    vec4  _worldPosition = worldMatrix * ((meshMatrix * positionsDecompressMatrix) * vec4(position, 1.0)); 
                    vec4  viewPosition  = viewMatrix * _worldPosition;                   
                    vec4 clipPos        = projMatrix * viewPosition;");

                    meshFlags2         = meshFlags2.r;                                          
                    fragDepth          = 1.0 + clipPos.w;");
                    isPerspective      = float (isPerspectiveMatrix(projMatrix));
                    worldPosition  = _worldPosition;");                                                 
                    gl_Position    = clipPos;
                }`;
    }
    
    protected get vertShaderSource(): string {
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
        
                uniform highp   sampler2D   cameraMatrices;
                uniform highp   sampler2D   sceneModelMatrices;
                uniform mediump sampler2D   eachMeshMatrices;
                uniform lowp    usampler2D  eachMeshAttributes;
                uniform highp   sampler2D   eachMeshOffset;
                uniform mediump usampler2D  positions;
                uniform highp   usampler2D  indices;
                uniform mediump usampler2D  eachTriangleMesh;
                
                uniform  float  logDepthBufFC;
                 
                out vec4        worldPosition;
                out int         meshFlags2;                       
                out uvec4       meshColor;
                out float       fragDepth;
                
                bool isPerspectiveMatrix(mat4 m) {
                    return (m[2][3] == - 1.0);
                }
                
                out float isPerspective;
                    
                void main(void) {
                                   
                    int triangleIndex      = gl_VertexID / 3;
                    
                    int hPackedMeshIdIndex = (triangleIndex >> 3) & 1023;
                    int vPackedMeshIdIndex = (triangleIndex >> 3) >> 10;
                    
                    int meshIndex          = int(texelFetch(eachTriangleMesh, ivec2(hPackedMeshIdIndex, vPackedMeshIdIndex), 0).r);                   
                    uvec4 meshFlags        = texelFetch (eachMeshAttributes, ivec2(2, meshIndex), 0);

                    if (int(meshFlags.x) != renderPass) {
                        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                        return;
                    } 
                 
                    mat4 viewMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 0), 0), texelFetch (cameraMatrices,     ivec2(1, 0), 0), texelFetch (cameraMatrices,     ivec2(2, 0), 0), texelFetch (cameraMatrices,     ivec2(3, 0), 0));
                    mat4 projMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 2), 0), texelFetch (cameraMatrices,     ivec2(1, 2), 0), texelFetch (cameraMatrices,     ivec2(2, 2), 0), texelFetch (cameraMatrices,     ivec2(3, 2), 0));
                    mat4 worldMatrix = mat4 (texelFetch (sceneModelMatrices, ivec2(0, 0), 0), texelFetch (sceneModelMatrices, ivec2(1, 0), 0), texelFetch (sceneModelMatrices, ivec2(2, 0), 0), texelFetch (sceneModelMatrices, ivec2(3, 0), 0));
                
                    uvec4 meshFlags2 = texelFetch (eachMeshAttributes, ivec2(3, meshIndex), 0);

                    ivec4 packedVertexBase = ivec4(texelFetch (eachMeshAttributes, ivec2(4, meshIndex), 0));
                    ivec4 packedIndexBaseOffset = ivec4(texelFetch (eachMeshAttributes, ivec2(5, meshIndex), 0));
                    int indexBaseOffset = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;

                    int hIndex = (triangleIndex - indexBaseOffset) & 1023;
                    int vIndex = (triangleIndex - indexBaseOffset) >> 10;

                    ivec3 vertexIndices = ivec3(texelFetch(indices, ivec2(hIndex, vIndex), 0));
                    ivec3 uniqueVertexIndexes = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;

                    ivec3 indexPositionH = uniqueVertexIndexes & 1023;
                    ivec3 indexPositionV = uniqueVertexIndexes >> 10;

                    mat4 positionsDecompressMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(0, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(1, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(2, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(3, meshIndex), 0));
                    mat4 meshMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(4, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(5, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(6, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(7, meshIndex), 0));

                    _positions[0] = vec3(texelFetch(positions, ivec2(indexPositionH.r, indexPositionV.r), 0));
                    _positions[1] = vec3(texelFetch(positions, ivec2(indexPositionH.g, indexPositionV.g), 0));
                    _positions[2] = vec3(texelFetch(positions, ivec2(indexPositionH.b, indexPositionV.b), 0));
  
                    vec3  position      = _positions[gl_VertexID % 3];
                    vec4  _worldPosition = worldMatrix * ((meshMatrix * positionsDecompressMatrix) * vec4(position, 1.0)); 
                    vec4  viewPosition  = viewMatrix * _worldPosition;                   
                    vec4 clipPos        = projMatrix * viewPosition;");

                    meshFlags2         = meshFlags2.r;                     
                    meshColor      = texelFetch (eachMeshAttributes, ivec2(0, meshIndex), 0);                          
                    fragDepth      = 1.0 + clipPos.w;");
                    isPerspective  = float (isPerspectiveMatrix(projMatrix));
                    worldPosition  = _worldPosition;");                                                 
                    gl_Position    = clipPos;
                }`;
    }

    protected get fragReadDataTextures(): string {
        return `${this.fragHeader}                        
    
                in uvec4        meshColor;
                in float        fragDepth;
                in float        isPerspective;    
                in vec4         worldPosition;
                in int          meshFlags2;        
    
                uniform float   logDepthBufFC;                        
    
                ${this.fragSectionPlaneUniforms}       
               
                ${this.fragLightSourceUniforms}                                                             
    
                out vec4 outColor;        
    
                void main(void) {                
    
                    ${this.fragSectionPlaneSlicing}                                    
    
                    outColor = meshColor;
                    
                    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( fragDepth ) * logDepthBufFC * 0.5;                        
                }`;
    }

    
    
    protected get vertLogDepthBufLogic(): string {
        if (this.#view.logarithmicDepthBufferEnabled) {
            return `fragDepth = 1.0 + clipPos.w;
                    isPerspective = float (isPerspectiveMatrix(projMatrix));`;
        } else {
            return ""
        }
    }

    _buildVertexShader() {
        const scene = this._scene;
        const sectionPlanesState = scene._sectionPlanesState;
        const lightsState = scene._lightsState;
        const clipping = sectionPlanesState.sectionPlanes.length > 0;
        let light;
        const src = [];
        src.push("#version 300 es");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("precision highp usampler2D;");
        src.push("precision highp isampler2D;");
        src.push("precision highp sampler2D;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("precision mediump usampler2D;");
        src.push("precision mediump isampler2D;");
        src.push("precision mediump sampler2D;");
        src.push("#endif");

        src.push("uniform int renderPass;");

        if (scene.entityOffsetsEnabled) {
            src.push("in vec3 offset;");
        }

        // src.push("uniform sampler2D uOcclusionTexture;"); // chipmunk

        src.push("uniform mediump sampler2D eachMeshMatrices;"); // chipmunk
        src.push("uniform lowp usampler2D eachMeshAttributes;"); // chipmunk
        src.push("uniform highp sampler2D eachMeshOffset;"); // chipmunk
        src.push("uniform mediump usampler2D positions;"); // chipmunk
        src.push("uniform highp usampler2D indices;"); // chipmunk
        src.push("uniform mediump usampler2D eachTriangleMesh;"); // chipmunk
        src.push("uniform highp sampler2D cameraMatrices;"); // chipmunk
        src.push("uniform highp sampler2D sceneModelMatrices;"); // chipmunk

        src.push("vec3 positions[3];")

        if (scene.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float fragDepth;");
            src.push("bool isPerspectiveMatrix(mat4 m) {");
            src.push("    return (m[2][3] == - 1.0);");
            src.push("}");
            src.push("out float isPerspective;");
        }

        src.push("uniform vec4 lightAmbient;");

        for (let i = 0, len = lightsState.lights.length; i < len; i++) {
            light = lightsState.lights[i];
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

        if (clipping) {
            src.push("out vec4 worldPosition;");
            src.push("out int meshFlags2;");
        }

        src.push("out vec4 meshColor;");

        src.push("void main(void) {");

        src.push("mat4 viewMatrix = mat4 (texelFetch (cameraMatrices, ivec2(0, 0), 0), texelFetch (cameraMatrices, ivec2(1, 0), 0), texelFetch (cameraMatrices, ivec2(2, 0), 0), texelFetch (cameraMatrices, ivec2(3, 0), 0));");
        src.push("mat4 viewNormalMatrix = mat4 (texelFetch (cameraMatrices, ivec2(0, 1), 0), texelFetch (cameraMatrices, ivec2(1, 1), 0), texelFetch (cameraMatrices, ivec2(2, 1), 0), texelFetch (cameraMatrices, ivec2(3, 1), 0));");
        src.push("mat4 projMatrix = mat4 (texelFetch (cameraMatrices, ivec2(0, 2), 0), texelFetch (cameraMatrices, ivec2(1, 2), 0), texelFetch (cameraMatrices, ivec2(2, 2), 0), texelFetch (cameraMatrices, ivec2(3, 2), 0));");

        src.push("mat4 worldMatrix = mat4 (texelFetch (sceneModelMatrices, ivec2(0, 0), 0), texelFetch (sceneModelMatrices, ivec2(1, 0), 0), texelFetch (sceneModelMatrices, ivec2(2, 0), 0), texelFetch (sceneModelMatrices, ivec2(3, 0), 0));");

        // constants
        src.push("int triangleIndex = gl_VertexID / 3;")

        // get packed mesh-id
        src.push("int hPackedMeshIdIndex = (triangleIndex >> 3) & 1023;")
        src.push("int vPackedMeshIdIndex = (triangleIndex >> 3) >> 10;")

        src.push("int meshIndex = int(texelFetch(eachTriangleMesh, ivec2(hPackedMeshIdIndex, vPackedMeshIdIndex), 0).r);");

        // get meshFlags & meshFlags2
        src.push("uvec4 meshFlags = texelFetch (eachMeshAttributes, ivec2(2, meshIndex), 0);"); // chipmunk
        src.push("uvec4 meshFlags2 = texelFetch (eachMeshAttributes, ivec2(3, meshIndex), 0);"); // chipmunk

        // meshFlags.x = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE

        src.push(`if (int(meshFlags.x) != renderPass) {`);
        src.push("   gl_Position = vec4(3.0, 3.0, 3.0, 1.0);"); // Cull vertex
        src.push("   return;"); // Cull vertex
        src.push("} else {");

        // get vertex base
        src.push("ivec4 packedVertexBase = ivec4(texelFetch (eachMeshAttributes, ivec2(4, meshIndex), 0));");

        src.push("ivec4 packedIndexBaseOffset = ivec4(texelFetch (eachMeshAttributes, ivec2(5, meshIndex), 0));");

        src.push("int indexBaseOffset = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;");

        src.push("int hIndex = (triangleIndex - indexBaseOffset) & 1023;")
        src.push("int vIndex = (triangleIndex - indexBaseOffset) >> 10;")

        src.push("ivec3 vertexIndices = ivec3(texelFetch(indices, ivec2(hIndex, vIndex), 0));");
        src.push("ivec3 uniqueVertexIndexes = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;")

        src.push("ivec3 indexPositionH = uniqueVertexIndexes & 1023;")
        src.push("ivec3 indexPositionV = uniqueVertexIndexes >> 10;")

        src.push("mat4 positionsDecompressMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(0, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(1, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(2, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(3, meshIndex), 0));")
        src.push("mat4 meshMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(4, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(5, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(6, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(7, meshIndex), 0));")

        src.push("positionsDecompressMatrix = meshMatrix * positionsDecompressMatrix;")

        // get position
        src.push("positions[0] = vec3(texelFetch(positions, ivec2(indexPositionH.r, indexPositionV.r), 0));")
        src.push("positions[1] = vec3(texelFetch(positions, ivec2(indexPositionH.g, indexPositionV.g), 0));")
        src.push("positions[2] = vec3(texelFetch(positions, ivec2(indexPositionH.b, indexPositionV.b), 0));")

        // get color
        src.push("uvec4 color = texelFetch (eachMeshAttributes, ivec2(0, meshIndex), 0);"); // chipmunk

        // get normal
        src.push("vec3 normal = -normalize(cross(positions[2] - positions[0], positions[1] - positions[0]));");

        src.push("vec3 position = positions[gl_VertexID % 3];");

        src.push("vec4 worldPosition = worldMatrix * (positionsDecompressMatrix * vec4(position, 1.0)); ");

        // get XYZ offset
        src.push("vec3 offset = texelFetch (eachMeshOffset, ivec2(0, meshIndex), 0).rgb;");

        src.push("worldPosition.xyz = worldPosition.xyz + offset;");

        src.push("vec4 viewPosition = viewMatrix * worldPosition; ");

        src.push("mat4 entityNormalMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(8, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(9, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(10, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(11, meshIndex), 0));")

        src.push("vec4 worldNormal = entityNormalMatrix * worldNormalMatrix * vec4(normal, 1); ");

        src.push("vec3 viewNormal = normalize((viewNormalMatrix * worldNormal).xyz);");

        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");

        src.push("float lambertian = 1.0;");
        for (let i = 0, len = lightsState.lights.length; i < len; i++) {
            light = lightsState.lights[i];
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

        src.push("vec3 rgb = vec3(color.rgb) / 255.0;");
        src.push("meshColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");

        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (scene.logarithmicDepthBufferEnabled) {
            src.push("fragDepth = 1.0 + clipPos.w;");
            src.push("isPerspective = float (isPerspectiveMatrix(projMatrix));");
        }
        if (clipping) {
            src.push("worldPosition = worldPosition;");
            src.push("meshFlags2 = meshFlags2.r;");
        }
        src.push("gl_Position = clipPos;");
        src.push("}");

        src.push("}");

        return src;
    }

    protected get fragmentShader(): string {
        return `
        ${this.fragGammaFunctionDefs}
        ${this.fragHeader}
        ${this.fragSectionPlaneUniforms}
        ${this.fragLightsDefs}
        ${this.fragLogDepthBufDefs}
        void main(void) {
            ${this.fragSectionPlaneSlicing}
            ${this.fragLightsLogic}
            ${this.fragDepthBufLogic}
        }`;
    }


    protected get fragGammaFunctionDefs(): string {
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

    protected get fragLightsDefs(): string {
        const view = this.#view;
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

    protected get fragLightsLogic(): string {
        const src = [];
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vec4 modelNormal = vec4(octDecode(normal.xy), 0.0); ");
        src.push("vec4 worldNormal = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        src.push("vec3 viewNormal = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
        src.push("float lambertian = 1.0;");

        for (let i = 0, len = this.#view.lightsList.length; i < len; i++) {
            const light: any = this.#view.lightsList[i];
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
        if (this.#view.sao.enabled) {
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

    protected get fragHeader(): string {
        return `#version 300 es
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        precision highp int;
        #else");
        precision mediump float;
        precision mediump int;
        #endif`;
    }

    protected get fragLogDepthBufDefs(): string {
        if (this.#view.logarithmicDepthBufferEnabled) {
            return `in float isPerspective;
                    uniform float logDepthBufFC;
                    in float fragDepth;`;
        } else {
            return ""
        }
    }

    protected get fragDepthBufLogic(): string {
        if (this.#view.logarithmicDepthBufferEnabled) {
            return "gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( fragDepth ) * logDepthBufFC * 0.5;";
        } else {
            return ""
        }
    }

    protected get fragSectionPlaneUniforms(): string {
        const src = [];
        src.push(`in vec4 worldPosition;
                  in vec4 meshFlags2;`);
        for (let i = 0, len = this.#view.sectionPlanesList.length; i < len; i++) {
            src.push(`uniform bool sectionPlaneActive${i};
                      uniform vec3 sectionPlanePos${i};
                      uniform vec3 sectionPlaneDir${i};`);
        }
        return src.join("\n");
    }

    protected get fragLightSourceUniforms(): string {
        const src = [];
        src.push(`uniform vec4 lightAmbient;`);
        for (let i = 0, len = this.#view.lightsList.length; i < len; i++) {
            const light = this.#view.lightsList[i];
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


    protected get fragSectionPlaneSlicing(): string {
        const src = [];
        const clipping = (this.#view.sectionPlanesList.length > 0);
        if (clipping) {
            src.push(`bool clippable = (float(meshFlags2.x) > 0.0);
                      if (clippable) {
                          float dist = 0.0;`);
            for (let i = 0, len = this.#view.sectionPlanesList.length; i < len; i++) {
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
        return src.join("\n");
    }

    destroy() {
        if (this.#program) {
            this.#program.destroy();
        }
        this.#program = null;
    }
}
