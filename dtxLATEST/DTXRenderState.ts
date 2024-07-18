import {WebGLRendererTextureSet} from "./../WebGLRendererTextureSet";
import {DTXTextureSet} from "./DTXTextureSet";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export interface DTXRenderState {
    gl: WebGL2RenderingContext,
    primitive: number;
    origin: FloatArrayParam,
    materialTextureSet: WebGLRendererTextureSet;
    dataTextureSet: DTXTextureSet | null;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number;
    numVertices: number;
}
