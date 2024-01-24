import {RenderContext} from "./RenderContext";
import {View} from "@xeokit/viewer";

/**
 * @private
 */
export abstract class LayerRenderer {

    renderContext: RenderContext;
    view: View;

    constructor(renderContext: RenderContext) {
        this.renderContext = renderContext;
        this.view = renderContext.view;
    }

    protected abstract buildVertexShader(): string;

    protected abstract buildFragmentShader(): string;

    protected abstract getHash(): string;

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

        return "";

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
        return "";

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
}