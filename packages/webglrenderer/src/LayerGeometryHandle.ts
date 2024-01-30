import {FloatArrayParam} from "@xeokit/math";
import {LayerGeometryBucket} from "./LayerGeometryBucket";

/**
 * @private
 */
export interface LayerGeometryHandle {
    aabb: FloatArrayParam;
    positionsDecompressMatrix: FloatArrayParam;
    geometryBucketHandles: LayerGeometryBucket[]
}