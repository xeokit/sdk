import {Geometry, GeometryBucketParams, GeometryCompressedParams} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * @private
 */
export class GeometryImpl implements Geometry {
    geometryBuckets: GeometryBucketParams[];
    geometryId: string;
    positionsDecompressMatrix: FloatArrayParam;
    primitive: number;

    constructor(params: GeometryCompressedParams) {
        this.geometryBuckets = params.geometryBuckets;
        this.geometryId = params.geometryId;
        this.positionsDecompressMatrix = params.positionsDecompressMatrix;
        this.primitive = params.primitive;
    }
}