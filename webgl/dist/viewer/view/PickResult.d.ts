import type { ViewObject } from "./ViewObject";
import type * as math from "../math/index";
/**
 * Results of a pick attempted with {@link View.pick}.
 */
declare class PickResult {
    #private;
    constructor();
    /**
     * The picked {@link ViewObject}.
     */
    get viewObject(): ViewObject | null | undefined;
    /**
     * @private
     */
    set viewObject(value: ViewObject | null | undefined);
    /**
     * View coordinates when picking with a 2D pointer.
     */
    get canvasPos(): Int16Array | undefined;
    /**
     * @private
     */
    set canvasPos(value: math.FloatArrayParam | Int16Array | undefined);
    /**
     * World-space 3D ray origin when raypicked.
     */
    get origin(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set origin(value: any);
    /**
     * World-space 3D ray direction when raypicked.
     */
    get direction(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set direction(value: any);
    /**
     * Picked triangle's vertex indices.
     * Only defined when an object and triangle was picked.
     */
    get indices(): Int32Array | null;
    /**
     * @private
     */
    set indices(value: any);
    /**
     * Picked Local-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get localPos(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set localPos(value: any);
    /**
     * Picked World-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldPos(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set worldPos(value: any);
    /**
     * Picked View-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get viewPos(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set viewPos(value: any);
    /**
     * Normal vector at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldNormal(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set worldNormal(value: any);
    /**
     * UV coordinates at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get uv(): math.FloatArrayParam | null;
    /**
     * @private
     */
    set uv(value: any);
    /**
     * @private
     */
    reset(): void;
}
export { PickResult };
