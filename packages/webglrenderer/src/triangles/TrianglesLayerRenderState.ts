import {WebGLRendererTextureSet} from "../WebGLRendererTextureSet";
import {TrianglesDataTextureSet} from "./TrianglesDataTextureSet";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export interface TrianglesLayerRenderState { // What a TrianglesLayerRenderer needs to render this TrianglesRendererLayer
    gl: WebGL2RenderingContext,
    origin: FloatArrayParam,
    materialTextureSet: WebGLRendererTextureSet; // Color, opacity, metal/roughness, ambient occlusion maps
    dataTextureSet: TrianglesDataTextureSet | null;
    primitive: number;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number; // How many 32-bit encodable edge indices in layer
    numVertices: number; // How many vertices in layer
}