
import type {FloatArrayParam} from "@xeokit/math";

/**
 * TODO
 */
export interface PickParams  {

    /**
     * Whether to snap to the nearest vertex to {@link PickParams.canvasPos}.
     */
    snapToVertex?:boolean;

    /**
     * Whether to snap to the nearest edge to {@link PickParams.canvasPos}.
     */
    snapToEdge?:boolean;

    /**
     * The snap radius around {@link PickParams.canvasPos}, in canvas pixels.
     */
    snapRadius?:number;

    /**
     * Set this ````true```` to perform a ray-pick; leave ````false```` to pick at canvas coordinates.
     */
    rayPick?: boolean;

    /**
     * Set this ````true```` to pick a {@link @xeokit/viewer!ViewObject | ViewObjects}.
     */
    pickViewObject?: boolean;

    /**
     * Set this ````true```` to pick a 3D position on a surface.
     */
    pickSurface?: boolean;

    /**
     * Set this ````false```` to not pick invisible {@link @xeokit/viewer!ViewObject | ViewObjects}. Default is ````true````.
     */
    pickInvisible?: boolean;

    /**
     * Set this ````true```` when ray-picking to pick the normal vector on the surface of the picked object.
     */
    pickSurfaceNormal?: boolean;

    /**
     * Canvas coordinates, used when {@link PickParams.rayPick} is ````false````.
     */
    canvasPos?: FloatArrayParam;

    /**
     * Ray-picking origin, used when {@link PickParams.rayPick} is ````true````.
     */
    rayOrigin?: FloatArrayParam;

    /**
     * Ray-picking direction, used when {@link PickParams.rayPick} is ````true````.
     */
    rayDirection?: FloatArrayParam;

    /**
     * Ray-picking direction matrix, used when {@link PickParams.rayPick} is ````true````.
     */
    rayMatrix?: FloatArrayParam;
}
