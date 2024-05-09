import {FloatArrayParam} from "@xeokit/math";
import {DTXLayerGeometryBucket} from "./DTXLayerGeometryBucket";

/**
 * @private
 */
export interface DTXLayerGeometryHandle {
    aabb: FloatArrayParam;
    positionsDecompressMatrix: FloatArrayParam;
    geometryBucketHandles: DTXLayerGeometryBucket[]
}
