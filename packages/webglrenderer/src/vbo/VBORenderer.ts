import {WebGLAttribute, WebGLProgram} from "@xeokit/webglutils";
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
            silhouetteColor: program.getLocation("silhouetteColor"),
            sectionPlanes: [],
            lightColor: [],
            lightDir: [],
            lightPos: [],
            lightAttenuation: [],
            lightAmbient: program.getLocation("lightAmbient")
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
        src.push("// vertexHeader")
        src.push(`// ${this.constructor.name} vertex shader`);
    }

    vertexCommonDefs(src: string[]) {
        src.push("// ------------------- vertexCommonDefs")
        src.push("in float flags;");
        src.push("uniform int renderPass;");
        src.push("");
    }

    vertexBatchingTransformDefs(src: string[]) {
        src.push("// ------------------- vertexBatchingTransformDefs")
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 positionsDecodeMatrix;");
        src.push("in vec3 position;");
    }

    vertexInstancingTransformDefs(src: string[]) {
        src.push("// ------------------- vertexInstancingTransformDefs")
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 positionsDecodeMatrix;");
        src.push("in vec3 position;");
        src.push("in vec4 modelMatrixCol0;");
        src.push("in vec4 modelMatrixCol1;");
        src.push("in vec4 modelMatrixCol2;");
    }

    vertexPickMeshShadingDefs(src: string[]) {
        src.push("// ------------------- vertexPickMeshShadingDefs")
        src.push("in vec4 pickColor;");
        src.push("out vec4 vPickColor;");
    }

    vertexSlicingDefs(src: string[]) {
        if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
            src.push("// ------------------- vertexSlicingDefs")
            src.push("out vec4 vWorldPosition;");
            src.push("out boolean vClippable;");
        }
    }

    openVertexMain(src: string[]) {
        src.push("void main(void) {");
        src.push(`      if ((int(flags) & 0xF) != renderPass) {`);
        src.push("          gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("      } else {");
    }

    openVertexSilhouetteMain(src: string[]) {
        src.push("void main(void) {");
        src.push(`      if ((int(flags) >> 4 & 0xF) != renderPass) {`);
        src.push("          gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("      } else {");
    }

    openVertexPickMain(src: string[]) {
        src.push("void main(void) {");
        src.push(`      if ((int(flags) >> 12 & 0xF) != renderPass) {`);
        src.push("          gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("      } else {");
    }

    openVertexEdgesMain(src: string[]) {
        src.push("void main(void) {");
        src.push(`      if ((int(flags) >> 8 & 0xF) != renderPass) {`);
        src.push("          gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("      } else {");
    }

    closeVertexMain(src: string[]) {
        src.push("      }");
        src.push("}");
    }

    vertexSlicingLogic(src: string[]) {
        if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
            src.push("      // ------------------- vertexSlicingLogic")
            src.push("      vWorldPosition = worldPosition;");
            src.push("      vClippable = (int(flags) >> 16 & 0xF) == 1;");
        }
    }

    vertexBatchingTransformLogic(src: string[]) {
        src.push("          // ------------------- vertexBatchingTransformLogic")
        src.push("          vec4 worldPosition = (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("          gl_Position = projMatrix * viewPosition;");
    }

    vertexInstancingTransformLogic(src: string[]) {
        src.push("          // ------------------- vertexInstancingTransformLogic")
        src.push("          vec4 worldPosition = (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("          vec4 viewPosition  = viewMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0); ");
        src.push("          gl_Position = projMatrix * viewPosition;");
    }

    vertexDrawLambertDefs(src: string[]) {
        src.push("          // ------------------- vertexDrawLambertDefs")
        src.push("          in  vec4 color;");
        src.push("          out vec4 vColor;");
        src.push("          out vec4 vViewPosition;");
    }

    vertexDrawLambertLogic(src: string[]) { // Depends on vertexInstancingTransformLogic / vertexBatchingTransformLogic
        src.push("          // ------------------- vertexDrawLambertLogic")
        src.push("          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
        src.push("          vViewPosition = viewPosition;");
    }

    vertexDrawSilhouetteDefs(src: string[]) {
        src.push("          // ------------------- vertexDrawSilhouetteDefs")
        src.push("          uniform vec4 silhouetteColor;");
        src.push("          out vec4 vColor;");
    }

    vertexDrawSilhouetteLogic(src: string[]) {
        src.push("          // ------------------- vertexDrawSilhouetteLogic")
        src.push("          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
    }

    vertexDrawFlatColorDefs(src: string[]) {
        src.push("          // ------------------- vertexDrawFlatColorDefs")
        src.push("          in vec4 color;");
        src.push("          out vec4 vColor;");
    }

    vertexDrawFlatColorLogic(src: string[]) {
        src.push("          // ------------------- vertexDrawFlatColorLogic")
        src.push("          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
    }

    vertexDrawEdgesColorDefs(src: string[]) {
        src.push("          // ------------------- vertexDrawEdgesColorDefs")
        src.push("          in vec4 color;");
        src.push("          out vec4 vColor;");
    }

    vertexDrawEdgesColorLogic(src: string[]) {
        src.push("          // ------------------- vertexDrawEdgesColorLogic")
        src.push("          vColor = vec4(1.0, float(color.g-300.0) / 255.0, float(color.b-0.5) / 255.0, 1.0);");
    }

    vertexDrawEdgesSilhouetteDefs(src: string[]) {
        src.push("          // ------------------- vertexDrawEdgesSilhouetteDefs")
        src.push("          uniform vec4 silhouetteColor;");
        src.push("          out vec4 vColor;");
    }

    vertexDrawEdgesSilhouetteLogic(src: string[]) {
        src.push("          // ------------------- vertexDrawEdgesSilhouetteLogic")
        src.push("          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
    }

    vertexPickMeshShadingLogic(src: string[]) {
        src.push("          // ------------------- vertexPickMeshShadingLogic")
        src.push("          vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
    }

    fragmentHeader(src: string[]) {
        src.push('#version 300 es');
        src.push(`// ${this.constructor.name} fragment shader`);
    }

    fragmentPrecisionDefs(src: string[]) {
        src.push("// ------------------- fragmentPrecisionDefs")
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
    }

    fragmentDrawLambertDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawLambertDefs")
        const view = this.renderContext.view;
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
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
        src.push("// ------------------- fragmentDrawLambertLogic")
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
        src.push("outColor = vec4((lightAmbient.rgb * lightAmbient.a * vColor.rgb) + (reflectedColor * vColor.rgb), vColor.a);");
    }

    fragmentDrawSilhouetteDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawSilhouetteDefs")
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
    }

    fragmentDrawSilhouetteLogic(src: string[]) {
        src.push("// ------------------- fragmentDrawSilhouetteLogic")
        src.push("outColor = vColor;");
    }

    fragmentDrawFlatColorDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawFlatColorDefs")
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
    }

    fragmentDrawFlatColorLogic(src: string[]) {
        src.push("// ------------------- fragmentDrawFlatColorLogic")
        src.push("outColor = vColor;");
    }

    fragmentDrawEdgesColorDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawEdgesColorDefs")
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
    }

    fragmentDrawEdgesColorLogic(src: string[]) {
        src.push("// ------------------- fragmentDrawEdgesColorLogic")
        src.push("outColor = vColor;");
    }

    fragmentDrawEdgesSilhouetteDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawEdgesSilhouetteDefs")
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
    }

    fragmentDrawEdgesSilhouetteLogic(src: string[]) {
        src.push("// ------------------- fragmentDrawEdgesSilhouetteLogic")
        src.push("outColor = vColor;");
    }

    fragmentPickMeshShadingDefs(src: string[]) {
        src.push("// ------------------- fragmentDrawSilhouetteDefs")
        src.push("in vec4 vPickColor;");
        src.push("out vec4 outColor;");
    }

    fragmentPickMeshShadingLogic(src: string[]) {
        src.push("// ------------------- fragmentDrawSilhouetteLogic")
        src.push("outColor = vPickColor;");
    }

    fragmentSlicingDefs(src: string[]) {
        const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
        if (numSectionPlanes === 0) {
            return;
        }
        src.push("// ------------------- fragmentSlicingDefs")
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
        src.push("// ------------------- fragmentSlicingLogic")
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

    bind(renderPass: number): boolean {
        const view = this.renderContext.view;
        const gl = this.renderContext.gl;
        const uniforms = this.uniforms;
        this.renderContext.textureUnit = 0;
        if (this.program && !this.getValid()) {
            this.program.destroy();
            this.program = null;
        }
        if (!this.program) {
            this.build();
            if (this.errors) {
                return false;
            }
            this.renderContext.lastProgramId = -1;
        }
        if (!this.program) {
            return false;
        }
        if (this.renderContext.lastProgramId === this.program.id) {
            return true; // Already bound
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
