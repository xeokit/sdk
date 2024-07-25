import type {FloatArrayParam} from "@xeokit/math";
import {createAABB3} from "@xeokit/boundaries";
import {SceneQuantizationRangeParams} from "./SceneQuantizationRangeParams";


/**
 * A geometry in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.quantizationRanges | SceneModel.quantizationRanges}
 * * Created with {@link @xeokit/scene!SceneModel.createQuantizationRange | SceneModel.createQuantizationRange}
 * * Referenced by {@link @xeokit/scene!SceneGeometry.geometry | SceneGeometry.geometry}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneQuantizationRange {

    /**
     * ID for the geometry.
     */
    id: string;

    /**
     * Matrix to decompress {@link @xeokit/scene!SceneQuantizationRangeBucketParams.positionsCompressed}.
     */
    aabb: FloatArrayParam;

    constructor(params: SceneQuantizationRangeParams) {
        this.aabb = params.aabb ? params.aabb.slice() : createAABB3();
    }

    /**
     * Gets this SceneQuantizationRange as JSON.
     */
    getJSON(): SceneQuantizationRangeParams {
        const quantizationRangeParams = <SceneQuantizationRangeParams>{
            id: this.id,
            aabb: [
                this.aabb[0],
                this.aabb[1],
                this.aabb[2],
                this.aabb[3],
                this.aabb[4],
                this.aabb[5]
            ]
        };

        return quantizationRangeParams;
    }
}
