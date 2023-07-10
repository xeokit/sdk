import { type FloatArrayParam, type IntArrayParam } from "@xeokit/math";
/**
 * Builds edge connectivity indices from a 3D triangle mesh given as vertex positions and triangle indices
 * @private
 */
export declare function buildEdgeIndices(positions: FloatArrayParam, indices: IntArrayParam, positionsDecompressMatrix: FloatArrayParam, edgeThreshold: number): IntArrayParam;
