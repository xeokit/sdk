import { FloatArrayParam, IntArrayParam } from "../math";
/**
 * Builds edge connectivity indices from a 3D triangle mesh given as vertex positions and triangle indices
 */
export declare function buildEdgeIndices(positions: FloatArrayParam, indices: IntArrayParam, positionsDecompressMatrix: FloatArrayParam, edgeThreshold: number): IntArrayParam;
