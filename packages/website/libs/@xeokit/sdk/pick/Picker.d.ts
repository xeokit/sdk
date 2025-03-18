import { SceneObjectsKdTree3 } from "../kdtree3";
import type { FloatArrayParam } from "../math";
import type { RayPickResult } from "./RayPickResult";
import type { MarqueePickResult } from "./MarqueePickResult";
/**
 * See {@link pick | @xeokit/sdk/pick} for usage.
 */
export declare class Picker {
    #private;
    constructor();
    /**
     * TODO
     * @param params
     */
    rayPick(params: {
        sceneObjectsKdTree3: SceneObjectsKdTree3;
        origin: FloatArrayParam;
        dir: FloatArrayParam;
    }): RayPickResult;
    /**
     * Picks a {@link kdtree3!SceneObjectsKdTree3} using a 2D marquee to obtain a {@link MarqueePickResult}
     * containing picked {@link scene!SceneObject | SceneObjects}, {@link scene!SceneMesh | SceneMesh}, {@link scene!SceneGeometry | SceneGeometry},
     * {@link scene!SceneGeometryBucket | GeometryBuckets}, {@link KdTrianglePrim}, {@link KdLinePrim} and {@link KdPointPrim}.
     * @param params
     */
    marqueePick(params: {
        sceneObjectsKdTree3: SceneObjectsKdTree3;
        marquee: FloatArrayParam;
    }): MarqueePickResult;
}
//# sourceMappingURL=Picker.d.ts.map