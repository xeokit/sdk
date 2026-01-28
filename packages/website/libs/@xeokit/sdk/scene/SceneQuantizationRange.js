import { createAABBFloat64 } from "../boundaries";
/**
 * A geometry in a {@link scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link scene!SceneModel.quantizationRanges | SceneModel.quantizationRanges}
 * * Created with {@link scene!SceneModel.createQuantizationRange | SceneModel.createQuantizationRange}
 * * Referenced by {@link scene!SceneGeometry.geometry | SceneGeometry.geometry}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneQuantizationRange {
    /**
     * ID for the geometry.
     */
    id;
    /**
     * Axis-aligned 3D boundary to dequantize the positions.
     */
    aabb;
    constructor(params) {
        this.aabb = params.aabb ? params.aabb.slice() : createAABBFloat64();
    }
    /**
     * Gets this SceneQuantizationRange as JSON.
     */
    getJSON() {
        const quantizationRangeParams = {
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
//# sourceMappingURL=SceneQuantizationRange.js.map
