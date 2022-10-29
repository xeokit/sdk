import {BasicVBOLayerRenderer} from "../../../BasicVBOLayerRenderer";
import {View} from "../../../../../../../viewer/view/View";
import {AmbientLight, DirLight, PointLight} from "../../../../../../../viewer/view";

export class TrianglesBatchingColorRenderer extends BasicVBOLayerRenderer {

    #withSAO: boolean;

    constructor(view: View, withSAO: boolean) {
        super(view);
        this.#withSAO = withSAO;
    }

    getHash() {
        return [this.view.getLightsHash(), this.view.getSectionPlanesHash(), (this.#withSAO ? "sao" : "nosao")].join(";");
    }

    buildVertexShader(): string {
        const clipping = this.view.sectionPlanesList.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// TrianglesBatchingColorRenderer");
        src.push("uniform int renderPass;");
        src.push("in vec3 position;");
        src.push("in vec3 normal;");
        src.push("in vec4 color;");
        src.push("in vec4 flags;");
        src.push("in vec4 flags2;");
        //if (view.entityOffsetsEnabled) {
//            src.push("in vec3 offset;");
//        }
        src.push("uniform mat4 worldMatrix;");
        src.push("uniform mat4 worldNormalMatrix;");
        src.push("uniform mat4 viewMatrix;");
        src.push("uniform mat4 projMatrix;");
        src.push("uniform mat4 viewNormalMatrix;");
        src.push("uniform mat4 positionsDecompressMatrix;");
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("uniform float logDepthBufFC;");
            src.push("out float vFragDepth;");
            src.push("bool isPerspectiveMatrix(mat4 m) {");
            src.push("    return (m[2][3] == - 1.0);");
            src.push("}");
            src.push("out float isPerspective;");
        }
        src.push("uniform vec4 lightAmbient;");
        for (let i = 0, len = this.view.lightsList.length; i < len; i++) {
            const light = this.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            src.push("uniform vec4 lightColor" + i + ";");
            if (light instanceof DirLight) {
                src.push("uniform vec3 lightDir" + i + ";");
            }
            if (light instanceof PointLight) {
                src.push("uniform vec3 lightPos" + i + ";");
            }
            // if (typeof light === SpotLight) {
            //     src.push("uniform vec3 lightPos" + i + ";");
            //     src.push("uniform vec3 lightDir" + i + ";");
            // }
        }
        src.push("vec3 octDecode(vec2 oct) {");
        src.push("    vec3 v = vec3(oct.xy, 1.0 - abs(oct.x) - abs(oct.y));");
        src.push("    if (v.z < 0.0) {");
        src.push("        v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);");
        src.push("    }");
        src.push("    return normalize(v);");
        src.push("}");
        if (clipping) {
            src.push("out vec4 vWorldPosition;");
            src.push("out vec4 vFlags2;");
        }
        src.push("out vec4 vColor;");
        src.push("void main(void) {");
        // flags.x = NOT_RENDERED | COLOR_OPAQUE | COLOR_TRANSPARENT
        // renderPass = COLOR_OPAQUE
        src.push(`if (int(flags.x) != renderPass) {`);
        src.push("   gl_Position = vec4(0.0, 0.0, 0.0, 0.0);"); // Cull vertex
        src.push("} else {");
        src.push("vec4 worldPosition = worldMatrix * (positionsDecompressMatrix * vec4(position, 1.0)); ");
        // if (view.entityOffsetsEnabled) {
        //     src.push("worldPosition.xyz = worldPosition.xyz + offset;");
        // }
        src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
        src.push("vec4 worldNormal =  worldNormalMatrix * vec4(octDecode(normal.xy), 0.0); ");
        src.push("vec3 viewNormal = normalize((viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
        src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
        src.push("float lambertian = 1.0;");
        for (let i = 0, len = this.view.lightsList.length; i < len; i++) {
            const light = this.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            if (light instanceof DirLight) {
                // @ts-ignore
                if (light.space === "view") {
                    src.push("viewLightDir = normalize(lightDir" + i + ");");
                } else {
                    src.push("viewLightDir = normalize((viewMatrix * vec4(lightDir" + i + ", 0.0)).xyz);");
                }
            } else if (light instanceof PointLight) {
                // @ts-ignore
                if (light.space === "view") {
                    src.push("viewLightDir = -normalize(lightPos" + i + " - viewPosition.xyz);");
                } else {
                    src.push("viewLightDir = -normalize((viewMatrix * vec4(lightPos" + i + ", 0.0)).xyz);");
                }
            }
                // else if (typeof light === SpotLight) {
                //     if (light.space === "view") {
                //         src.push("viewLightDir = normalize(lightDir" + i + ");");
                //     } else {
                //         src.push("viewLightDir = normalize((viewMatrix * vec4(lightDir" + i + ", 0.0)).xyz);");
                //     }
            //    }
            else {
                continue;
            }
            src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
            src.push("reflectedColor += lambertian * (lightColor" + i + ".rgb * lightColor" + i + ".a);");
        }
        src.push("vec3 rgb = (vec3(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0));");
        src.push("vColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");
        src.push("vec4 clipPos = projMatrix * viewPosition;");
        if (this.view.logarithmicDepthBufferEnabled) {
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
        const clipping = this.view.sectionPlanesList.length > 0;
        const src = [];
        src.push("#version 300 es");
        src.push("// TrianglesBatchingColorRenderer");
        src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
        src.push("precision highp float;");
        src.push("precision highp int;");
        src.push("#else");
        src.push("precision mediump float;");
        src.push("precision mediump int;");
        src.push("#endif");
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("in float isPerspective;");
            src.push("uniform float logDepthBufFC;");
            src.push("in float vFragDepth;");
        }
        if (this.#withSAO) {
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
            src.push("in vec4 vWorldPosition;");
            src.push("in vec4 vFlags2;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("uniform bool sectionPlaneActive" + i + ";");
                src.push("uniform vec3 sectionPlanePos" + i + ";");
                src.push("uniform vec3 sectionPlaneDir" + i + ";");
            }
        }
        src.push("in vec4 vColor;");
        src.push("out vec4 outColor;");
        src.push("void main(void) {");
        if (clipping) {
            src.push("  bool clippable = (float(vFlags2.x) > 0.0);");
            src.push("  if (clippable) {");
            src.push("  float dist = 0.0;");
            for (let i = 0, len = this.view.sectionPlanesList.length; i < len; i++) {
                src.push("if (sectionPlaneActive" + i + ") {");
                src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
                src.push("}");
            }
            src.push("  if (dist > 0.0) { ");
            src.push("      discard;")
            src.push("  }");
            src.push("}");
        }
        if (this.view.logarithmicDepthBufferEnabled) {
            src.push("    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;");
        }
        if (this.#withSAO) {
            // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
            // Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
            src.push("   float viewportWidth     = uSAOParams[0];");
            src.push("   float viewportHeight    = uSAOParams[1];");
            src.push("   float blendCutoff       = uSAOParams[2];");
            src.push("   float blendFactor       = uSAOParams[3];");
            src.push("   vec2 uv                 = vec2(gl_FragCoord.x / viewportWidth, gl_FragCoord.y / viewportHeight);");
            src.push("   float ambient           = smoothstep(blendCutoff, 1.0, unpackRGBToFloat(texture(uOcclusionTexture, uv))) * blendFactor;");
            src.push("   outColor            = vec4(vColor.rgb * ambient, 1.0);");
        } else {
            src.push("   outColor            = vColor;");
        }
        src.push("}");
        return src.join("\n");
    }
}
