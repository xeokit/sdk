import {FloatArrayParam} from "@xeokit/math";
import {TrianglesLayerGeometryBucket} from "./TrianglesLayerGeometryBucket";

/**
 * @private
 */
export interface TrianglesGeometryHandle { // Storage handle for a geometry within a TrianglesLayer
    aabb: FloatArrayParam;
    positionsDecompressMatrix: FloatArrayParam;
    geometryBucketHandles: TrianglesLayerGeometryBucket[]
}