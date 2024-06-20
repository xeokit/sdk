import {WebGLRenderer} from "../../WebGLRenderer";
import {RenderStats} from "../../RenderStats";
import {RenderContext} from "../../RenderContext";
import {VBOPointsLayer} from "./VBOPointsLayer";
import {WebGLAttribute, WebGLProgram} from "@xeokit/webglutils";
import {PerspectiveProjection} from "@xeokit/viewer";
import {OrthoProjectionType} from "@xeokit/constants";
import {createVec4} from "@xeokit/matrix";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {createRTCViewMat} from "@xeokit/rtc";

const tempVec4 = createVec4();

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
abstract class VBOBatchingPointsRenderer {

    renderContext: RenderContext;
    hash: string;
    program: WebGLProgram | null;
    #needRebuild: boolean;
    errors: string[];
    uniforms: {
        pointCloudIntensityRange: WebGLUniformLocation;
        nearPlaneHeight: WebGLUniformLocation;
        color: WebGLUniformLocation;
        pickZNear: WebGLUniformLocation;
        logDepthBufFC: WebGLUniformLocation;
        renderPass: WebGLUniformLocation;
        snapCameraEyeRTC: WebGLUniformLocation;
        pointSize: WebGLUniformLocation;
        intensityRange: WebGLUniformLocation;
        pickZFar: WebGLUniformLocation;
        worldMatrix: WebGLUniformLocation;
        sectionPlanes: any[];
        sceneModelMatrix: WebGLUniformLocation;
        projMatrix: WebGLUniformLocation;
        viewMatrix: WebGLUniformLocation;
    };
    attributes: {
        color: WebGLAttribute;
        intensity: WebGLAttribute;
        flags: WebGLAttribute;
        position: WebGLAttribute;
        pickColor: WebGLAttribute
    };

    constructor(renderContext: RenderContext) {
        this.renderContext = renderContext;
        this.#needRebuild = true;
        this.build();
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
            snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
            logDepthBufFC: program.getLocation("logDepthBufFC"),
            pointSize: program.getLocation("pointSize"),
            intensityRange: program.getLocation("intensityRange"),
            nearPlaneHeight: program.getLocation("nearPlaneHeight"),
            pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
            pickZNear: program.getLocation("pickZNear"),
            pickZFar: program.getLocation("pickZFar"),
            color: program.getLocation("color"),
            sectionPlanes: []
        };

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
            color: program.getAttribute("color"),
            intensity: program.getAttribute("intensity"),
            flags: program.getAttribute("flags"),
            pickColor: program.getAttribute("pickColor")
        }

        this.hash = this.getHash();

        this.#needRebuild = false;
    }

    abstract buildVertexShader(): string;

    abstract buildFragmentShader(): string;

    getHash(): string {
        return `${this.sectionPlanesHash}-
        ${this.renderContext.view.pointsMaterial.perspectivePoints}-
        ${this.renderContext.view.pointsMaterial.filterIntensity}-
        ${this.renderContext.view.logarithmicDepthBufferEnabled}`;
    }

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
    }

    destroy() {
        if (this.program) {
            this.program.destroy();
        }
        this.program = null;
    }
}

/**
 * @private
 */
class VBOBatchingPointsColorRenderer extends VBOBatchingPointsRenderer {

    buildVertexShader(): string {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        const src = [];
        src.push("#version 300 es");
        src.push("// Points batching color vertex shader");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        src.push("in vec4 color;");
        src.push("in float flags;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecodeMatrix;");
        src.push("uniform float pointSize;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (pointsMaterial.filterIntensity) {
            src.push("uniform vec2 intensityRange;");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out float vFlags;");
        }
        src.push("out vec4 vColor;");
        src.push("void main(void) {");
        // colorFlag = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`int colorFlag = int(flags) & 0xF;`);
        src.push(`if (colorFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        if (pointsMaterial.filterIntensity) {
            src.push("float intensity = float(color.a) / 255.0;")
            src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
            src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
            src.push("} else {");
        }
        src.push("vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
        }
        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        src.push("}");
        if (pointsMaterial.filterIntensity) {
            src.push("}");
        }
        src.push("}");
        return joinSansComments(src);
    }

    buildFragmentShader(): string {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const src = [];
        src.push('#version 300 es');
        src.push("// Points batching color fragment shader");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");

        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in float vFlags;");
            for (let i = 0, len = view.getNumAllocatedSectionPlanes(); i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        if (clipping) {
            src.push("  bool clippable = (int(vFlags) >> 16 & 0xF) == 1;");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = view.getNumAllocatedSectionPlanes(); i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { discard; }");
            src.push("}");
        }
        src.push("   outColor = vColor;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("}");
        return joinSansComments(src);
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number): void {
        this.bind();
        const attributes = this.attributes;
        const renderState = vboPointsLayer.renderState;
        const gl = this.renderContext.gl;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
        }
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
        }
        if (attributes.intensity) {
            // attributes.intensity.bindArrayBuffer(renderState.intensitiesBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        gl.drawArrays(gl.POINTS, 0, renderState.positionsBuf.numItems);
    }
}

/**
 * @private
 */
class VBOBatchingPointsSilhouetteRenderer extends VBOBatchingPointsRenderer {

    buildVertexShader() {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        const src = [];
        src.push('#version 300 es');
        src.push("// Points batching silhouette vertex shader");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        src.push("in float flags;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecodeMatrix;");
        src.push("uniform vec4 color;");
        src.push("uniform float pointSize;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out float vFlags;");
        }
        src.push("void main(void) {");
        // silhouetteFlag = NOT_RENDERED | SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | SILHOUETTE_XRAYED
        // renderPass = SILHOUETTE_HIGHLIGHTED | SILHOUETTE_SELECTED | | SILHOUETTE_XRAYED
        src.push(`int silhouetteFlag = int(flags) >> 4 & 0xF;`);
        src.push(`if (silhouetteFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
        }
        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        src.push("}");
        src.push("}");
        return joinSansComments(src);
    }

    buildFragmentShader(): string {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        const src = [];
        src.push('#version 300 es');
        src.push("// Points batching silhouette vertex shader");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in float vFlags;");
            for (let i = 0, len = view.getNumAllocatedSectionPlanes(); i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("uniform vec4 color;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        if (clipping) {
            src.push("  bool clippable = (int(vFlags) >> 16 & 0xF) == 1;");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = view.getNumAllocatedSectionPlanes(); i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { discard; }");
            src.push("}");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("outColor = color;");
        src.push("}");
        return joinSansComments(src);
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number): void {
        this.bind();
        const view = this.renderContext.view;
        let material;
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
            material = view.xrayMaterial;
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
            material = view.highlightMaterial;
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
            material = view.selectedMaterial;
        } else {
            return;
        }
        const gl = this.renderContext.gl;
        const color = material.fillColor;
        const alpha = material.fillAlpha;
        gl.uniform4f(this.uniforms.color, color[0], color[1], color[2], alpha);
        const attributes = this.attributes;
        const renderState = vboPointsLayer.renderState;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.color) {
            attributes.color.bindArrayBuffer(renderState.colorsBuf);
        }
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        gl.drawArrays(gl.POINTS, 0, renderState.positionsBuf.numItems);
    }
}

/**
 * @private
 */
export class VBOBatchingPointsPickMeshRenderer extends VBOBatchingPointsRenderer {

    buildVertexShader(): string {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const pointsMaterial = view.pointsMaterial;
        const src = [];
        src.push('#version 300 es');
        src.push("// Points batching pick mesh vertex shader");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        src.push("in float flags;");
        src.push("in vec4 pickColor;");
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 positionsDecodeMatrix;");
        src.push("uniform float pointSize;");
        if (pointsMaterial.perspectivePoints) {
            src.push("uniform float nearPlaneHeight;");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
        }
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out float vFlags;");
        }
        src.push("out vec4 vPickColor;");
        src.push("void main(void) {");
        // pickFlag = NOT_RENDERED | PICK
        // renderPass = PICK
        src.push(`int pickFlag = int(flags) >> 12 & 0xF;`);
        src.push(`if (pickFlag != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("  } else {");
        src.push("      vec4 worldPosition = worldMatrix * (positionsDecodeMatrix * vec4(position, 1.0)); ");
        src.push("      vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("      vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
        if (clipping) {
            src.push("      vWorldPosition = worldPosition;");
            src.push("      vFlags = flags;");
        }
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
        }
        src.push("gl_Position = clipPos;");
        if (pointsMaterial.perspectivePoints) {
            src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
            src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
            src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
        } else {
            src.push("gl_PointSize = pointSize;");
        }
        src.push("gl_PointSize += 10.0;");
        src.push("  }");
        src.push("}");
        return joinSansComments(src);
    }

    buildFragmentShader(): string {
        const renderContext = this.renderContext;
        const view = renderContext.view;
        const clipping = view.getNumAllocatedSectionPlanes() > 0;
        const src = [];
        src.push(`#version 300 es
        // Points batching pick mesh vertex shader
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        precision highp int;
        #else;
        precision mediump float;
        precision mediump int;
        #endif`);
        if (view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (clipping) {
            src.push("in vec4 vWorldPosition;");
            src.push("in float vFlags;");
            for (var i = 0; i < view.getNumAllocatedSectionPlanes(); i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vPickColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (view.pointsMaterial.roundPoints) {
            src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
            src.push("  float r = dot(cxy, cxy);");
            src.push("  if (r > 1.0) {");
            src.push("       discard;");
            src.push("  }");
        }
        if (clipping) {
            src.push("  bool clippable = (int(vFlags) >> 16 & 0xF) == 1;");
            src.push("  if (clippable) {");
            src.push("      float dist = 0.0;");
            for (let i = 0; i < view.getNumAllocatedSectionPlanes(); i++) {
                src.push("      if (sectionPlaneActive" + i + ") {");
                src.push("          dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("      }");
            }
            src.push("      if (dist > 0.0) { discard; }");
            src.push("  }");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        src.push("   outColor = vPickColor; ");
        src.push("}");
        return joinSansComments(src);
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number) {
        this.bind();
        const gl = this.renderContext.gl;
        const attributes = this.attributes;
        const renderState = vboPointsLayer.renderState;
        attributes.position.bindArrayBuffer(renderState.positionsBuf);
        if (attributes.pickColor) {
            attributes.pickColor.bindArrayBuffer(renderState.pickColorsBuf);
        }
        if (attributes.flags) {
            attributes.flags.bindArrayBuffer(renderState.flagsBuf);
        }
        gl.uniform1i(this.uniforms.renderPass, renderPass);
        gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, <Float32Array | GLfloat[]>createRTCViewMat(this.renderContext.view.camera.viewMatrix, renderState.origin));
        gl.drawArrays(gl.POINTS, 0, renderState.positionsBuf.numItems);
    }
}

/**
 * @private
 */
class VBOBatchingPointsPickDepthRenderer extends VBOBatchingPointsRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext);
    }

    buildVertexShader(): string {
        return ``;
    }

    buildFragmentShader(): string {
        return ``;
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number) {
        this.bind();
    }
}

/**
 * @private
 */
class VBOBatchingPointsOcclusionRenderer extends VBOBatchingPointsRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext);
    }

    buildVertexShader(): string {
        return ``;
    }

    buildFragmentShader(): string {
        return ``;
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number) {
        this.bind();
    }
}

/**
 * @private
 */
class VBOBatchingPointsSnapInitRenderer extends VBOBatchingPointsRenderer {

    constructor(renderContext: RenderContext, whatIsThisFlag: boolean) { // TODO
        super(renderContext);
    }

    buildVertexShader(): string {
        return ``;
    }

    buildFragmentShader(): string {
        return ``;
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number) {
        this.bind();
    }
}

/**
 * @private
 */
class VBOBatchingPointsSnapRenderer extends VBOBatchingPointsRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext);
    }

    buildVertexShader(): string {
        return ``;
    }

    buildFragmentShader(): string {
        return ``;
    }

    draw(vboPointsLayer: VBOPointsLayer, renderPass: number) {
        this.bind();
    }
}

/**
 * @private
 */
export class VBOPointsRendererSet {

    renderContext: RenderContext;
    renderStats: RenderStats;

    #colorRenderer: VBOBatchingPointsColorRenderer;
    #silhouetteRenderer: VBOBatchingPointsSilhouetteRenderer;
    #pickMeshRenderer: VBOBatchingPointsPickMeshRenderer;
    #pickDepthRenderer: VBOBatchingPointsPickDepthRenderer;
    #occlusionRenderer: VBOBatchingPointsOcclusionRenderer;
    #snapInitRenderer: VBOBatchingPointsSnapInitRenderer;
    #snapRenderer: VBOBatchingPointsSnapRenderer;

    constructor(renderContext: RenderContext, renderStats: RenderStats) {
        this.renderContext = renderContext;
        this.renderStats = renderStats;
    }

    _compile() {
        if (this.#colorRenderer && (!this.#colorRenderer.getValid())) {
            this.#colorRenderer.destroy();
            this.#colorRenderer = null;
        }
        if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
            this.#silhouetteRenderer.destroy();
            this.#silhouetteRenderer = null;
        }
        if (this.#pickMeshRenderer && (!this.#pickMeshRenderer.getValid())) {
            this.#pickMeshRenderer.destroy();
            this.#pickMeshRenderer = null;
        }
        if (this.#pickDepthRenderer && (!this.#pickDepthRenderer.getValid())) {
            this.#pickDepthRenderer.destroy();
            this.#pickDepthRenderer = null;
        }
        if (this.#occlusionRenderer && this.#occlusionRenderer.getValid() === false) {
            this.#occlusionRenderer.destroy();
            this.#occlusionRenderer = null;
        }
        if (this.#snapInitRenderer && (!this.#snapInitRenderer.getValid())) {
            this.#snapInitRenderer.destroy();
            this.#snapInitRenderer = null;
        }
        if (this.#snapRenderer && (!this.#snapRenderer.getValid())) {
            this.#snapRenderer.destroy();
            this.#snapRenderer = null;
        }
    }

    _eagerCreate() {

    }

    get colorRenderer(): VBOBatchingPointsColorRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = new VBOBatchingPointsColorRenderer(this.renderContext);
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer() {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new VBOBatchingPointsSilhouetteRenderer(this.renderContext);
        }
        return this.#silhouetteRenderer;
    }

    get pickMeshRenderer() {
        if (!this.#pickMeshRenderer) {
            this.#pickMeshRenderer = new VBOBatchingPointsPickMeshRenderer(this.renderContext);
        }
        return this.#pickMeshRenderer;
    }

    get pickDepthRenderer() {
        if (!this.#pickDepthRenderer) {
            this.#pickDepthRenderer = new VBOBatchingPointsPickDepthRenderer(this.renderContext);
        }
        return this.#pickDepthRenderer;
    }

    get occlusionRenderer() {
        if (!this.#occlusionRenderer) {
            this.#occlusionRenderer = new VBOBatchingPointsOcclusionRenderer(this.renderContext);
        }
        return this.#occlusionRenderer;
    }

    get snapInitRenderer() {
        if (!this.#snapInitRenderer) {
            this.#snapInitRenderer = new VBOBatchingPointsSnapInitRenderer(this.renderContext, false);
        }
        return this.#snapInitRenderer;
    }

    get snapRenderer() {
        if (!this.#snapRenderer) {
            this.#snapRenderer = new VBOBatchingPointsSnapRenderer(this.renderContext);
        }
        return this.#snapRenderer;
    }

    _destroy() {
        if (this.#colorRenderer) {
            this.#colorRenderer.destroy();
        }
        if (this.#silhouetteRenderer) {
            this.#silhouetteRenderer.destroy();
        }
        if (this.#pickMeshRenderer) {
            this.#pickMeshRenderer.destroy();
        }
        if (this.#pickDepthRenderer) {
            this.#pickDepthRenderer.destroy();
        }
        if (this.#occlusionRenderer) {
            this.#occlusionRenderer.destroy();
        }
        if (this.#snapInitRenderer) {
            this.#snapInitRenderer.destroy();
        }
        if (this.#snapRenderer) {
            this.#snapRenderer.destroy();
        }
    }
}

const rendererSets = {};

/**
 * @private
 */
export function getRenderers(webglRenderer: WebGLRenderer): VBOPointsRendererSet {
    const viewerId = webglRenderer.viewer.id;
    let rendererSet = rendererSets[viewerId];
    if (!rendererSet) {
        rendererSet = new VBOPointsRendererSet(webglRenderer.renderContext, webglRenderer.renderStats);
        rendererSets[viewerId] = rendererSet;
        rendererSet._compile();
        rendererSet._eagerCreate();
        webglRenderer.onCompiled.sub(() => {
            rendererSet._compile();
            rendererSet._eagerCreate();
        });
        webglRenderer.onDestroyed.sub(() => {
            delete rendererSets[viewerId];
            rendererSet._destroy();
        });
    }
    return rendererSet;
}
