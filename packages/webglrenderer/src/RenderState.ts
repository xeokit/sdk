import {WebGLRendererTextureSet} from "./WebGLRendererTextureSet";
import {DataTextureSet} from "./DataTextureSet";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export interface RenderState {
    gl: WebGL2RenderingContext,
    primitive: number;
    origin: FloatArrayParam,
    materialTextureSet: WebGLRendererTextureSet;
    dataTextureSet: DataTextureSet | null;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number;
    numVertices: number;
}