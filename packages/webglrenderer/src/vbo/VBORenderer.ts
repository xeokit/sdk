import {WEBGL_INFO, WebGLAttribute, WebGLProgram} from "@xeokit/webglutils";
import {OrthoProjectionType} from "@xeokit/constants";
import {AmbientLight, DirLight, PointLight} from "@xeokit/viewer";
import {RenderContext} from "../RenderContext";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {VBOInstancingLayer} from "./instancing/VBOInstancingLayer";
import {VBOBatchingLayer} from "./batching/VBOBatchingLayer";

const defaultColor = new Float32Array([1, 1, 1, 1]);

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
export abstract class VBORenderer {

    renderContext: RenderContext;
    hash: string;
    program: WebGLProgram | null;
    errors: string[];
    edges: boolean;

    #needRebuild: boolean;

    uniforms: {
        pointCloudIntensityRange: WebGLUniformLocation;
        nearPlaneHeight: WebGLUniformLocation;
        silhouetteColor: WebGLUniformLocation;
        gammaFactor: WebGLUniformLocation;
        pickZNear: WebGLUniformLocation;
        renderPass: WebGLUniformLocation;
        snapCameraEyeRTC: WebGLUniformLocation;
        pointSize: WebGLUniformLocation;
        intensityRange: WebGLUniformLocation;
        pickZFar: WebGLUniformLocation;
        pickClipPos: WebGLUniformLocation;
        drawingBufferSize: WebGLUniformLocation;
        worldMatrix: WebGLUniformLocation;
        positionsDecompressOffset: WebGLUniformLocation;
        positionsDecompressScale: WebGLUniformLocation;
        sectionPlanes: any[];
        sceneModelMatrix: WebGLUniformLocation;
        projMatrix: WebGLUniformLocation;
        viewMatrix: WebGLUniformLocation;
        lightPos: WebGLUniformLocation[];
        lightDir: WebGLUniformLocation[];
        lightColor: WebGLUniformLocation[];
        lightAttenuation: WebGLUniformLocation[];
        lightAmbient: WebGLUniformLocation;
        saoParams: WebGLUniformLocation;
    };

    attributes: {
        color: WebGLAttribute;
        normal: WebGLAttribute;
        intensity: WebGLAttribute;
        flags: WebGLAttribute;
        uv: WebGLAttribute;
        position: WebGLAttribute;
        pickColor: WebGLAttribute;
        modelMatrix: WebGLAttribute;
        modelMatrixCol0: WebGLAttribute;
        modelMatrixCol1: WebGLAttribute;
        modelMatrixCol2: WebGLAttribute;
    };

    samplers: {
        saoOcclusionTexture: "saoOcclusionTexture";
    };

    constructor(renderContext: RenderContext, cfg: { edges: boolean } = {edges: false}) {
        this.renderContext = renderContext;
        this.#needRebuild = true;
        this.edges = cfg.edges;
        this.build();
    }

    abstract getHash(): string;

    get lambertShadingHash() {
        return this.renderContext.view.getLightsHash();
    }

    get slicingHash() {
        return this.renderContext.view.getSectionPlanesHash();
    }

    get pointsHash() {
        const pointsMaterial = this.renderContext.view.pointsMaterial;
        return `${pointsMaterial.roundPoints}-${pointsMaterial.perspectivePoints}`;
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

    build(): void {

        const view = this.renderContext.view;
        const gl = this.renderContext.gl;

        const vertexSrc = [];
        this.buildVertexShader(vertexSrc)

        const fragmentSrc = [];
        this.buildFragmentShader(fragmentSrc)

        this.program = new WebGLProgram(gl, {
            vertex: joinSansComments(vertexSrc),
            fragment: joinSansComments(fragmentSrc)
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
            positionsDecompressOffset: program.getLocation("positionsDecompressOffset"),
            positionsDecompressScale: program.getLocation("positionsDecompressScale"),
            snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
            pointSize: program.getLocation("pointSize"),
            intensityRange: program.getLocation("intensityRange"),
            nearPlaneHeight: program.getLocation("nearPlaneHeight"),
            pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
            pickZNear: program.getLocation("pickZNear"),
            pickZFar: program.getLocation("pickZFar"),
            pickClipPos: program.getLocation("pickClipPos"),
            drawingBufferSize: program.getLocation("drawingBufferSize"),
            silhouetteColor: program.getLocation("silhouetteColor"),
            sectionPlanes: [],
            lightColor: [],
            lightDir: [],
            lightPos: [],
            lightAttenuation: [],
            lightAmbient: program.getLocation("lightAmbient"),
            saoParams: program.getLocation("saoParams")
        };

        const lights = view.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
            const light = lights[i];
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
            intensity: program.getAttribute("intensity"),
            flags: program.getAttribute("flags"),
            pickColor: program.getAttribute("pickColor"),
            modelMatrix: program.getAttribute("modelMatrix"),

            // Instancing

            modelMatrixCol0: program.getAttribute("modelMatrixCol0"),
            modelMatrixCol1: program.getAttribute("modelMatrixCol1"),
            modelMatrixCol2: program.getAttribute("modelMatrixCol2")
        }

        this.hash = this.getHash();

        this.#needRebuild = false;
    }

    abstract buildVertexShader(src: string[]);

    abstract buildFragmentShader(src: string[]);

    vertexHeader(src: string[]) {
        src.push('#version 300 es');
        src.push(`// ${this.constructor.name} vertex shader`);
    }

    vertexCommonDefs(src: string[]) {
        src.push("in float flags;");
        src.push("uniform int renderPass;");
    }

    vertexBatchingTransformDefs(src: string[]) {
        src.push("in vec3 position;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform vec3 positionsDecompressOffset;");
        src.push("uniform vec3 positionsDecompressScale;");
    }

    vertexInstancingTransformDefs(src: string[]) {
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform vec3 positionsDecompressOffset;");
        src.push("uniform vec3 positionsDecompressScale;");
        src.push("in vec3 position;");
        src.push("in vec4 modelMatrixCol0;");
        src.push("in vec4 modelMatrixCol1;");
        src.push("in vec4 modelMatrixCol2;");
    }

    vertexPickMeshDefs(src: string[]) {
        src.push("in vec4 pickColor;");
        src.push("out vec4 vPickColor;");
        src.push("uniform vec2 drawingBufferSize;");
        src.push("uniform vec2 pickClipPos;");
        src.push("vec4 remapPickClipPos(vec4 clipPos) {");
        src.push("    clipPos.xy /= clipPos.w;");
        //if (viewportSize === 1) {
        src.push("    clipPos.xy = (clipPos.xy - pickClipPos) * drawingBufferSize;");
        // } else {
        //     src.push(`    clipPos.xy = (clipPos.xy - pickClipPos) * (drawingBufferSize / float(${viewportSize}));`);
        // }
        src.push("    clipPos.xy *= clipPos.w;")
        src.push("    return clipPos;")
        src.push("}");
    }

    vertexSlicingDefs(src: string[]) {
        if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
            src.push("out vec4 vWorldPosition;");
            src.push("out boolean vClippable;");
        }
    }

    vertexDrawMainOpen(src: string[]) {
        src.push("void main(void) {");
        src.push(`      int colorFlag = (int(flags) & 0xF);`);
        src.push(`      if (colorFlag != renderPass) {`);
        src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
        src.push("      } else {");
    }

    vertexSilhouetteMainOpen(src: string[]) {
        src.push("void main(void) {");
        src.push("      int silhouetteFlag = (int(flags) >> 4 & 0xF);")
        src.push(`      if (silhouetteFlag != renderPass) {`);
        src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
        src.push("      } else {");
    }

    vertexPickMainOpen(src: string[]) {
        src.push("void main(void) {");
        src.push(`      int pickFlag = int(flags) >> 8 & 0xF;`);
        src.push(`      if (pickFlag != renderPass) {`);
        src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
        src.push("      } else {");
    }

    vertexMainClose(src: string[]) {
        src.push("      }");
        src.push("}");
    }

    vertexSlicingLogic(src: string[]) {
        if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
            src.push("      vWorldPosition = worldPosition;");
            src.push("      vClippable = (int(flags) >> 12 & 0xF) == 1;");
        }
    }

    vertexDrawBatchingTransformLogic(src: string[]) {
        src.push("          vec4 worldPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("          gl_Position = projMatrix * viewPosition;");
    }

    vertexDrawPointsBatchingTransformLogic(src: string[]) {
        src.push("          vec4 worldPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("          vec4 clipPos = projMatrix * viewPosition;");
        src.push("          gl_Position = clipPos;");
        src.push("          clipPos.xy *= clipPos.w;");
    }

    vertexPickBatchingTransformLogic(src: string[]) {
        src.push("          vec4 worldPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("          gl_Position = remapPickClipPos(projMatrix * viewPosition);");
    }

    vertexDrawInstancingTransformLogic(src: string[]) {
        src.push("          vec4 worldPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0); ");
        src.push("          gl_Position = projMatrix * viewPosition;");
    }

    vertexPickInstancingTransformLogic(src: string[]) {
        src.push("          vec4 worldPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0); ");
        src.push("          gl_Position = remapPickClipPos(projMatrix * viewPosition);");
    }

    vertexDrawLambertDefs(src: string[]) {
        src.push("          in  vec4 color;");
        src.push("          out vec4 vColor;");
        src.push("          out vec4 vViewPosition;");
    }

    vertexDrawLambertLogic(src: string[]) {
        src.push("          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
        src.push("          vViewPosition = viewPosition;");
    }

    vertexSilhouetteDefs(src: string[]) {
        src.push("          uniform vec4 silhouetteColor;");
        src.push("          out vec4 vColor;");
    }

    vertexSilhouetteLogic(src: string[]) {
        src.push("          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
    }

    vertexDrawFlatColorLogic(src: string[]) {
        src.push("          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
    }

    vertexDrawFlatColorDefs(src: string[]) {
        src.push("          in vec4 color;");
        src.push("          out vec4 vColor;");
    }

    vertexDrawEdgesColorLogic(src: string[]) {
        src.push("          vColor = vec4(float(color.r-200.0) / 255.0, float(color.g-200.0) / 255.0, float(color.b-200.0) / 255.0, 1.0);");
    }

    vertexPickMeshLogic(src: string[]) {
        src.push("          vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
    }

    vertexPointsDrawDefs(src: string[]): void {
        src.push("in vec4 color;");
        src.push("out vec4 vColor;");
    }

    vertexDrawPointsColorsLogic(src: string[]): void {
        src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
    }

    vertexPointsGeometryDefs(src: string[]): void {
        const pointsMaterial = this.renderContext.view.pointsMaterial;
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (pointsMaterial.filterIntensity) {
            src.push("uniform vec2 intensityRange;");
        }
        src.push("uniform float pointSize;");
    }

    vertexPointsFilterLogicOpenBlock(src: string[]) {
        const pointsMaterial = this.renderContext.view.pointsMaterial;
        if (pointsMaterial.filterIntensity) {
            src.push("float intensity = float(color.a) / 255.0;")
            src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
            src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
            src.push("} else {");
        }
    }

    vertexPointsFilterLogicCloseBlock(src: string[]) {
        const pointsMaterial = this.renderContext.view.pointsMaterial;
        if (pointsMaterial.filterIntensity) {
            src.push("}");
        }
    }

    vertexPointsGeometryLogic(src: string[]) {
        const pointsMaterial = this.renderContext.view.pointsMaterial;
        // if (pointsMaterial.perspectivePoints) {
        //     src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
        //     src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
        //     src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        // } else {
        src.push("gl_PointSize = pointSize;");
        //       }
    }

    fragmentHeader(src: string[]) {
        src.push('#version 300 es');
        src.push(`// ${this.constructor.name} fragment shader`);
    }

    fragmentPrecisionDefs(src: string[]) {
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
    }

    fragmentCommonDefs(src: string[]) {
        src.push("vec4 color;");
        src.push("out vec4 outColor;");
    }

    fragmentDrawLambertDefs(src: string[]) {
        const view = this.renderContext.view;
        src.push("in vec4 vColor;");
        src.push("in vec4 vViewPosition;");
        src.push("uniform vec4 lightAmbient;");
        src.push("uniform mat4 viewMatrix;");
        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light = view.lightsList[i];
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
    }

    fragmentDrawLambertLogic(src: string[]) {
        const view = this.renderContext.view;
        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
        src.push("float lambertian = 1.0;");
        src.push("vec3 xTangent = dFdx( vViewPosition.xyz );");
        src.push("vec3 yTangent = dFdy( vViewPosition.xyz );");
        src.push("vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light = view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            if (light instanceof DirLight) {
                if (light.space === "view") {
                    src.push(`viewLightDir = normalize(lightDir${i});`);
                } else {
                    src.push(`viewLightDir = normalize((viewMatrix * vec4(lightDir${i}, 0.0)).xyz);`);
                }
            } else if (light instanceof PointLight) {
                if (light.space === "view") {
                    src.push(`viewLightDir = -normalize(lightPos${i} - viewPosition.xyz);`);
                } else {
                    src.push(`viewLightDir = -normalize((viewMatrix * vec4(lightPos${i}, 0.0)).xyz);`);
                }
            } else {
                continue;
            }
            src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
            src.push(`reflectedColor += lambertian * (lightColor${i}.rgb * lightColor${i}.a);`);
        }
        src.push("color = vec4((lightAmbient.rgb * lightAmbient.a * vColor.rgb) + (reflectedColor * vColor.rgb), vColor.a);");
    }

    fragmentDrawSAODefs(src: string[]) {
        src.push("uniform sampler2D saoOcclusionTexture;");
        src.push("uniform vec4      saoParams;");
        src.push("const float       saoUnpackDownScale = 255. / 256.;");
        src.push("const vec3        saoPackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );");
        src.push("const vec4        saoUnpackFactors = saoUnpackDownScale / vec4( saoPackFactors, 1. );");
        src.push("float saoUnpackRGBToFloat( const in vec4 v ) {");
        src.push("    return dot( v, saoUnpackFactors );");
        src.push("}");
    }

    fragmentSilhouetteDefs(src: string[]) {
        src.push(
            "in vec4 vColor;",
        );
    }

    fragmentDrawFlatColorDefs(src: string[]) {
        src.push("in vec4 vColor;");
    }

    fragmentDrawFlatColorLogic(src: string[]) {
        src.push("color = vColor;");
    }

    fragmentDrawSAOLogic(src: string[]) {
        // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
        // TODO: Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
        src.push("   float saoViewportWidth = saoParams[0];");
        src.push("   float saoViewportHeight = saoParams[1];");
        src.push("   float saoBlendCutoff = saoParams[2];");
        src.push("   float saoBlendFactor = saoParams[3];");
        src.push("   vec2  saoUV = vec2(gl_FragCoord.x / saoViewportWidth, gl_FragCoord.y / saoViewportHeight);");
        src.push("   float saoAmbient = smoothstep(saoBlendCutoff, 1.0, saoUnpackRGBToFloat(texture(saoOcclusionTexture, saoUV))) * saoBlendFactor;");
        src.push("   color = vec4(color.rgb * saoAmbient, 1.0);");
    }

    fragmentDrawDepthDefs(src: string[]) {
        src.push("in vec2 vHighPrecisionZW;");
    }

    fragmentDrawDepthLogic(src: string[]) {
        src.push("float depthFragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;");
        src.push("color = vec4(vec3(1.0 - depthFragCoordZ), 1.0); ");
    }

    fragmentSilhouetteLogic(src: string[]) {
        src.push("color = vColor;");
    }

    fragmentPickMeshDefs(src: string[]) {
        src.push("in vec4 vPickColor;");
        src.push("out vec4 outColor;");
    }

    fragmentPickMeshLogic(src: string[]) {
        src.push("color = vPickColor;");
    }

    fragmentSlicingDefs(src: string[]) {
        const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
        if (numSectionPlanes === 0) {
            return;
        }
        src.push("in vec4 vWorldPosition;");
        src.push("in boolean vClippable;");
        for (let i = 0; i < numSectionPlanes; i++) {
            src.push("uniform bool sectionPlaneActive" + i + ";");
            src.push("uniform vec3 sectionPlanePos" + i + ";");
            src.push("uniform vec3 sectionPlaneDir" + i + ";");
        }
    }

    fragmentSlicingLogic(src: string[]) {
        const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
        if (numSectionPlanes === 0) {
            return;
        }
        src.push("  if (vClippable) {");
        src.push("    float dist = 0.0;");
        for (let i = 0; i < numSectionPlanes; i++) {
            src.push("    if (sectionPlaneActive" + i + ") {");
            src.push("      dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
            src.push("    }");
        }
        src.push("    if (dist > 0.0) { discard; }");
        src.push("  }");
    }


    fragmentPointsGeometryLogic(src: string[]): void {
        if (this.renderContext.view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
    }

    fragmentCommonOutput(src: string[]) {
        src.push("outColor = color;");
    }

    bind(renderPass: number): boolean {
        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.uniforms;
        const renderContext = this.renderContext;
        renderContext.textureUnit = 0;
        if (this.program && !this.getValid()) {
            this.program.destroy();
            this.program = null;
        }
        if (!this.program) {
            this.build();
            if (this.errors) {
                return false;
            }
            renderContext.lastProgramId = -1;
        }
        if (!this.program) {
            return false;
        }
        if (renderContext.lastProgramId === this.program.id) {
            return true; // Already bound
        }
        this.program.bind();
        renderContext.lastProgramId = this.program.id;
        gl.uniform1i(uniforms.renderPass, renderPass);
        if (uniforms.projMatrix) {
            gl.uniformMatrix4fv(uniforms.projMatrix, false,
                <Float32Array | GLfloat[]>
                    (renderPass === RENDER_PASSES.PICK
                        ? renderContext.pickProjMatrix
                        : view.camera.projMatrix));
        }
        if (uniforms.pointSize) {
            gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
        }
        if (uniforms.nearPlaneHeight) {
            gl.uniform1f(uniforms.nearPlaneHeight, (view.camera.projectionType === OrthoProjectionType) ? 1.0 : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0))));
        }
        if (uniforms.pickZNear) {
            gl.uniform1f(uniforms.pickZNear, renderContext.pickZNear);
            gl.uniform1f(uniforms.pickZFar, renderContext.pickZFar);
        }
        if (uniforms.drawingBufferSize) {
            gl.uniform2f(uniforms.drawingBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }
        if (uniforms.pickClipPos) {
            gl.uniform2fv(uniforms.pickClipPos, <Float32Array>renderContext.pickClipPos);
        }
        if (uniforms.lightAmbient) {
            gl.uniform4fv(uniforms.lightAmbient, <Float32Array>view.getAmbientColorAndIntensity());
        }
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
        if (this.uniforms.silhouetteColor) {
            if (this.edges) {
                if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
                    const material = view.xrayMaterial;
                    const color = material.edgeColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
                } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
                    const material = view.highlightMaterial;
                    const color = material.edgeColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
                } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
                    const material = view.selectedMaterial;
                    const color = material.edgeColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
                } else {
                    gl.uniform4fv(this.uniforms.silhouetteColor, defaultColor);
                }
            } else {
                if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
                    const material = view.xrayMaterial;
                    const color = material.fillColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
                } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
                    const material = view.highlightMaterial;
                    const color = material.fillColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
                } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
                    const material = view.selectedMaterial;
                    const color = material.fillColor;
                    gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
                } else {
                    gl.uniform4fv(this.uniforms.silhouetteColor, defaultColor);
                }
            }
        }
        const sao = view.sao;
        const saoEnabled = sao.possible;
        if (saoEnabled) {
            if (this.uniforms.saoParams) {
                gl.uniform4f(this.uniforms.saoParams, gl.drawingBufferWidth, gl.drawingBufferHeight, sao.blendCutoff, sao.blendFactor);
                this.program.bindTexture(
                    this.samplers.saoOcclusionTexture,
                    renderContext.saoOcclusionTexture,
                    renderContext.textureUnit);
                renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
            }
        }
        return true;
    }

    renderVBOInstancingLayer(vboInstancinglayer: VBOInstancingLayer, renderPass: number) {
        // Default no-op
    }

    renderVBOBatchingLayer(vboInstancinglayer: VBOBatchingLayer, renderPass: number) {
        // Default no-op
    }

    destroy() {
        if (this.program) {
            this.program.destroy();
        }
        this.program = null;
    }
}
