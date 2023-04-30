import { SceneObjectsKdTree3 } from "../kdtree3";
import { FloatArrayParam } from "@xeokit/math";
import { RayPickResult } from "./RayPickResult";
import { MarqueePickResult } from "./MarqueePickResult";
/**
 * See {@link "@xeokit/collision/pick"} for usage.
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
     * Picks a {@link SceneObjectsKdTree3} using a 2D marquee to obtain a {@link MarqueePickResult}
     * containing picked {@link SceneObject | SceneObjects}, {@link Mesh}, {@link Geometry},
     * {@link GeometryBucket | GeometryBuckets}, {@link KdTrianglePrim}, {@link KdLinePrim} and {@link KdPointPrim}.
     * @param params
     */
    marqueePick(params: {
        sceneObjectsKdTree3: SceneObjectsKdTree3;
        marquee: FloatArrayParam;
    }): MarqueePickResult;
}
