import type { math } from "../../viewer/index";
import { DataTexture } from "../lib/DataTexture";
/**
 * Creates DataTextures to hold various types of viewer state.
 */
export declare class DataTextureFactory {
    /**
     * Enables the currently bound ````WebGLTexture```` to be used as a data texture.
     */
    disableFilteringForBoundTexture(gl: WebGL2RenderingContext): void;
    /**
     * Creates a DataTexture containing the given vertex positions.
     */
    createPositionsDataTexture(gl: WebGL2RenderingContext, positions: math.FloatArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 8-bit indices.
     */
    createIndices8BitDataTexture(gl: WebGL2RenderingContext, indices_8Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 16-bit indices.
     */
    createIndices16BitDataTexture(gl: WebGL2RenderingContext, indices_16Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 32-bit indices.
     */
    createIndices32BitDataTexture(gl: WebGL2RenderingContext, indices_32Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 8-bit edge indices.
     */
    createEdgeIndices8BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_8Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 16-bit edge indices.
     */
    createEdgeIndices16BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_16Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given 32-bit edge indices.
     */
    createEdgeIndices32BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_32Bits: math.IntArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing per-mesh colors, pick colors, flags, vertex portion bases, indices portion bases, edge indices portion bases
     *
     * The texture will have:
     * - 4 RGBA columns per row: for each mesh (pick) color and flags(2)
     * - N rows where N is the number of meshes
     *
     * @param gl
     * @param colors Color per mesh
     * @param pickColors Pick color per mesh
     * @param vertexBases Vertex index base for each mesh
     * @param indexBaseOffsets For triangles: array of offsets between the (gl_VertexID / 3) and the position where the indices start in the texture layer
     * @param edgeIndexBaseOffsets For edges: Array of offsets between the (gl_VertexID / 2) and the position where the edge indices start in the texture layer
     */
    createEachMeshAttributesDataTexture(gl: WebGL2RenderingContext, colors: math.FloatArrayParam[], pickColors: math.FloatArrayParam[], vertexBases: math.IntArrayParam, indexBaseOffsets: math.IntArrayParam, edgeIndexBaseOffsets: math.IntArrayParam): DataTexture;
    /**
     * Creates DataTexture containing a 3D offset for each mesh
     *
     * @param gl
     * @param offsets An offset for each mesh
     */
    createEachEdgeOffsetDataTexture(gl: WebGL2RenderingContext, offsets: math.FloatArrayParam[]): DataTexture;
    /**
     * Creates a DataTexture that holds per-mesh matrices for positions decode, position modeling, and normals modeling.
     *
     * The texture will have:
     * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
     *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
     * - N rows where N is the number of meshes
     *
     * @param gl
     * @param positionDecodeMatrices Positions decode matrix for each mesh in the layer
     * @param matrices Positions instancing matrix for each mesh in the layer. Null if the meshes are not instanced.
     */
    createEachMeshMatricesDataTexture(gl: WebGL2RenderingContext, positionDecodeMatrices: math.FloatArrayParam, matrices: math.FloatArrayParam): DataTexture;
    /**
     * Creates a DataTexture containing the given mesh IDs.
     * This type of texture is used for a lookup table, of mesh IDs for given keys.
     *
     * @param gl
     * @param meshIds
     */
    createPointerTableDataTexture(gl: WebGL2RenderingContext, meshIds: math.IntArrayParam): DataTexture;
}
