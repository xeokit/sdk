import * as math from "../../../../../../../viewer/math";
import {BasicVBOLayerRenderer} from "../../../BasicVBOLayerRenderer";
import {View} from "../../../../../../../viewer/view/View";

export class TrianglesInstancingColorRenderer extends BasicVBOLayerRenderer {
    withSAO: boolean;

    constructor(view: View, withSAO: boolean) {
        super(view);
        this.withSAO = withSAO;
    }

    getHash(): string {
        return [this.view.getLightsHash(), this.view.getSectionPlanesHash(), (this.withSAO ? "sao" : "nosao")].join(";");
    }

    buildVertexShader(): string {
        const view = this.view;
        const clipping = view.sectionPlanesList.length > 0;
        const src = [];
        src.push(`  #version 300 es
                    // TrianglesInstancingColorRenderer
                    uniform int renderPass;
                    in vec3 position;
                    in vec2 normal;
                    in vec4 color;
                    in vec4 flags;
                    in vec4 flags2;
                    in vec4 modelMatrixCol0;
                    in vec4 modelMatrixCol1;
                    in vec4 modelMatrixCol2;
                    in vec4 modelNormalMatrixCol0;
                    in vec4 modelNormalMatrixCol1;
                    in vec4 modelNormalMatrixCol2;
                    uniform mat4 worldMatrix;
                    uniform mat4 worldNormalMatrix;
                    uniform mat4 viewMatrix;
                    uniform mat4 viewNormalMatrix;
                    uniform mat4 projMatrix;
                    uniform mat4 positionsDecompressMatrix;
                    uniform vec4 lightAmbient;
                    out vec4 vColor;
                    vec3 octDecode(vec2 oct) {
                        vec3 v = vec3(oct.xy, 1.0 - abs(oct.x) - abs(oct.y));
                        if (v.z < 0.0) {
                            v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
                        }
                        return normalize(v);
                    }`);

        // if (scene.entityOffsetsEnabled) {
        //     src.push("in vec3 offset;");
        // }

        if (view.logarithmicDepthBufferEnabled) {
            src.push(`  uniform float logDepthBufFC;
                        out float vFragDepth;
                        bool isPerspectiveMatrix(mat4 m) {
                            return (m[2][3] == - 1.0);
                        }
                        out float isPerspective;`);
        }

        src.push(this.getLightUniforms());

        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }

        // flags.x = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE | COLOR_TRANSPARENT

        src.push(`  void main(void) {
                        if (int(flags.x) != renderPass) {
                            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
                        } else {
                            vec4 worldPosition =  positionsDecompressMatrix * vec4(position, 1.0);
                            worldPosition = worldMatrix * vec4(dot(worldPosition, modelMatrixCol0), dot(worldPosition, modelMatrixCol1), dot(worldPosition, modelMatrixCol2), 1.0);`);

        // if (scene.entityOffsetsEnabled) {
        //     src.push("      worldPosition.xyz = worldPosition.xyz + offset;");
        // }

        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vec4 modelNormal = vec4(octDecode(normal.xy), 0.0); ");
        src.push("vec4 worldNormal = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        src.push("vec3 viewNormal = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
        src.push("float lambertian = 1.0;");

        for (let i = 0, len = view.lightsList.length; i < len; i++) {
            const light: any = view.lightsList[i];
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
        src.push("vColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("vFragDepth = 1.0 + clipPos.w;");
            src.push("isPerspective = float (isPerspectiveMatrix(projMatrix));");
        }
        if (clipping) {
            src.push("vWorldPosition = worldPosition;");
            src.push("vFlags2 = flags2;");
        }
        src.push("gl_Position = clipPos;");
        src.push("}");
        src.push("}");
        return src.join("\n");
    }

    buildFragmentShader(): string {
        const view = this.view;
        const clipping = view.sectionPlanesList.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// TrianglesInstancingColorRenderer");

        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (view.logarithmicDepthBufferEnabled) {
            src.push("in float isPerspective;");
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (this.withSAO) {
            src.push("uniform sampler2D uOcclusionTexture;");
            src.push("uniform vec4      uSAOParams;");
            src.push("const float       packUpscale = 256. / 255.;");
            src.push("const float       unpackDownScale = 255. / 256.;");
            src.push("const vec3        packFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );");
            src.push("const vec4        unPackFactors = unpackDownScale / vec4( packFactors, 1. );");

            src.push("float unpackRGBToFloat( const in vec4 v ) {");
            src.push("    return dot( v, unPackFactors );");
            src.push("}");
        }
        if (clipping) {
            src.push(this.getSectionPlaneUniforms());
        }
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { ");
            src.push("      discard;")
            src.push("  }");
            src.push("}");
        }
        if (view.logarithmicDepthBufferEnabled) {
            src.push("    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
        // Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
        if (this.withSAO) {
            src.push("   float viewportWidth     = uSAOParams[0];");
            src.push("   float viewportHeight    = uSAOParams[1];");
            src.push("   float blendCutoff       = uSAOParams[2];");
            src.push("   float blendFactor       = uSAOParams[3];");
            src.push("   vec2 uv                 = vec2(gl_FragCoord.x / viewportWidth, gl_FragCoord.y / viewportHeight);");
            src.push("   float ambient           = smoothstep(blendCutoff, 1.0, unpackRGBToFloat(texture(uOcclusionTexture, uv))) * blendFactor;");
            src.push("   outColor                = vec4(vColor.rgb * ambient, 1.0);");
        } else {
            src.push("    outColor           = vColor;");
        }
        src.push("}");
        return src.join("\n");
    }
}

