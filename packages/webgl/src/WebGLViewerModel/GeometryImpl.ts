import {Geometry, GeometryCompressedParams} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";
import {GeometryBucketImpl} from "./GeometryBucketImpl";

/**
 * @private
 */
export class GeometryImpl implements Geometry {
    id: string;
    primitive: number;
    positionsDecompressMatrix: FloatArrayParam;
    geometryBuckets: GeometryBucketImpl[];

    constructor(params: GeometryCompressedParams) {
        this.geometryBuckets = [];
        for (let i = 0, len = params.geometryBuckets.length; i < len; i++) {
            this.geometryBuckets[i] = new GeometryBucketImpl(params.geometryBuckets[i]);
        }
        this.id = params.id;
        this.positionsDecompressMatrix = params.positionsDecompressMatrix;
        this.primitive = params.primitive;
    }
}