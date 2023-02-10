import {Geometry, GeometryCompressedParams} from "@xeokit/core/components";
import {FloatArrayParam} from "@xeokit/math/math";
import {GeometryBucketImpl} from "./GeometryBucketImpl";

/**
 * @private
 */
export class GeometryImpl implements Geometry {
    id: string;
    geometryBuckets: GeometryBucketImpl[];
    positionsDecompressMatrix: FloatArrayParam;
    primitive: number;

    constructor(params: GeometryCompressedParams) {
        this.geometryBuckets = params.geometryBuckets;
        this.id = params.id;
        this.positionsDecompressMatrix = params.positionsDecompressMatrix;
        this.primitive = params.primitive;
    }
}