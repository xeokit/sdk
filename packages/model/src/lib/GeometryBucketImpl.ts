import {GeometryBucket, GeometryBucketParams} from "@xeokit/core/components";
import {IntArrayParam} from "@xeokit/math/math";

/**
 * @private
 */
export class GeometryBucketImpl implements GeometryBucket {

    positionsCompressed: IntArrayParam;
    uvsCompressed?: IntArrayParam;
    colorsCompressed?: IntArrayParam;
    indices?: IntArrayParam;
    edgeIndices?: IntArrayParam;

    constructor(geometryBucketParams: GeometryBucketParams) {
        this.positionsCompressed = geometryBucketParams.positionsCompressed;
        this.uvsCompressed = geometryBucketParams.uvsCompressed;
        this.colorsCompressed = geometryBucketParams.colorsCompressed;
        this.indices = geometryBucketParams.indices;
        this.edgeIndices = geometryBucketParams.edgeIndices;
    }
}