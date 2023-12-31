import type { ViewObject } from "./ViewObject";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Results of a pick attempted with {@link View.pick}.
 */
declare class PickResult {
    #private;
    constructor();
    /**
     * The picked {@link @xeokit/viewer!ViewObject}.
     */
    get viewObject(): ViewObject | null | undefined;
    /**
     * @private
     */
    set viewObject(value: ViewObject | null | undefined);
    /**
     * Canvas coordinates when picking with a 2D pointer.
     */
    get canvasPos(): Int16Array | undefined;
    /**
     * @private
     */
    set canvasPos(value: FloatArrayParam | Int16Array | undefined);
    /**
     * World-space 3D ray origin when raypicked.
     */
    get origin(): FloatArrayParam | null;
    /**
     * @private
     */
    set origin(value: any);
    /**
     * World-space 3D ray direction when raypicked.
     */
    get direction(): FloatArrayParam | null;
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
    get localPos(): FloatArrayParam | null;
    /**
     * @private
     */
    set localPos(value: any);
    /**
     * Picked World-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldPos(): FloatArrayParam | null;
    /**
     * @private
     */
    set worldPos(value: any);
    /**
     * Picked View-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get viewPos(): FloatArrayParam | null;
    /**
     * @private
     */
    set viewPos(value: any);
    /**
     * Normal vector at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get worldNormal(): FloatArrayParam | null;
    /**
     * @private
     */
    set worldNormal(value: any);
    /**
     * UV coordinates at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
    get uv(): FloatArrayParam | null;
    /**
     * @private
     */
    set uv(value: any);
    /**
     * Returns `true` if picking has snapped to the canvas coordinates of the nearest vertex.
     * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest vertex.
     */
    get snappedToVertex(): boolean;
    /**
     * @private
     */
    set snappedToVertex(value: boolean);
    /**
     * Returns `true` if picking has snapped to the canvas coordinates of the nearest edge.
     * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest edge.
     */
    get snappedToEdge(): boolean;
    set snappedToEdge(value: boolean);
    /**
     * Snapped canvas coordinates when picking with a 2D pointer.
     * This has a value when {@link PickResult.snappedToEdge} or {@link PickResult.snappedToVertex} is `true`, otherwise will be `null`.
     */
    get snappedCanvasPos(): Int16Array | undefined;
    /**
     * @private
     */
    set snappedCanvasPos(value: FloatArrayParam | Int16Array | undefined);
    /**
     * @private
     */
    reset(): void;
}
export { PickResult };
