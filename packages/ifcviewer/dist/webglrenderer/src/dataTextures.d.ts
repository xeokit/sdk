import type { FloatArrayParam, IntArrayParam } from "@xeokit/math";
import { WebGLDataTexture } from "@xeokit/webglutils";
/**
 * Enables the currently bound ````WebGLTexture```` to be used as a data texture.
 */
export declare function disableFilteringForBoundTexture(gl: WebGL2RenderingContext): void;
/**
 * Creates a WebGLDataTexture that holds per-geometry matrices for positions decode.
 *
 * The texture will have:
 * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
 *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
 * - N rows where N is the number of meshes
 *
 * @param gl
 * @param positionDecodeMatrices Positions decode matrix for each mesh in the layer
 */
export declare function createEachGeometryMatricesDataTexture(gl: WebGL2RenderingContext, positionDecodeMatrices: FloatArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given vertex positions.
 */
export declare function createPositionsDataTexture(gl: WebGL2RenderingContext, positions: FloatArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 8-bit indices.
 */
export declare function createIndices8BitDataTexture(gl: WebGL2RenderingContext, indices_8Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 16-bit indices.
 */
export declare function createIndices16BitDataTexture(gl: WebGL2RenderingContext, indices_16Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 32-bit indices.
 */
export declare function createIndices32BitDataTexture(gl: WebGL2RenderingContext, indices_32Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 8-bit edge indices.
 */
export declare function createEdgeIndices8BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_8Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 16-bit edge indices.
 */
export declare function createEdgeIndices16BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_16Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given 32-bit edge indices.
 */
export declare function createEdgeIndices32BitDataTexture(gl: WebGL2RenderingContext, edgeIndices_32Bits: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing per-mesh colors, pick colors, flags, vertex portion bases, indices portion bases, edge indices portion bases
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
export declare function createEachMeshAttributesDataTexture(gl: WebGL2RenderingContext, colors: FloatArrayParam[], pickColors: FloatArrayParam[], vertexBases: IntArrayParam, indexBaseOffsets: IntArrayParam, edgeIndexBaseOffsets: IntArrayParam): WebGLDataTexture;
/**
 * Creates WebGLDataTexture containing a 3D offset for each mesh
 *
 * @param gl
 * @param offsets An offset for each mesh
 */
export declare function createEachEdgeOffsetDataTexture(gl: WebGL2RenderingContext, offsets: FloatArrayParam[]): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture that holds per-mesh matrices for positions decode, position modeling, and normals modeling.
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
export declare function createEachMeshMatricesDataTexture(gl: WebGL2RenderingContext, positionDecodeMatrices: FloatArrayParam, matrices: FloatArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture containing the given mesh IDs.
 * This type of texture is used for a lookup table, of mesh IDs for given keys.
 *
 * @param gl
 * @param meshIds
 */
export declare function createPointerTableDataTexture(gl: WebGL2RenderingContext, meshIds: IntArrayParam): WebGLDataTexture;
/**
 * Creates a WebGLDataTexture that holds matrices.
 *
 * The texture will have:
 * - 4 RGBA columns per row (each column will contain 4 packed half-float (16 bits) components).
 *   Thus, each row will contain 16 packed half-floats corresponding to a complete positions decode matrix)
 * - N rows where N is the number of matrices
 *
 * @param gl
 * @param numMatrices
 */
export declare function createMatricesDataTexture(gl: WebGL2RenderingContext, numMatrices: number): WebGLDataTexture;
