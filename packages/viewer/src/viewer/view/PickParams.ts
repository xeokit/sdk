import type * as math from "../math/math";

/**
 * Parameters for {@link View.pick}.
 */
export interface PickParams  {

    /**
     * Set this ````true```` to perform a ray-pick; leave ````false```` to pick at canvas coordinates.
     */
    rayPick?: boolean;

    /**
     * Set this ````true```` when ray-picking to pick a 3D position on the surface of the picked object.
     */
    pickSurface?: boolean;

    /**
     * Set this ````true```` when ray-picking to pick the normal vector on the surface of the picked object.
     */
    pickSurfaceNormal?: boolean;

    /**
     * Don't pick {@link ViewObject}s with these IDs.
     */
    excludeViewObjectIds?: string[];

    /**
     * Only pick from among {@link ViewObject}s with these IDs.
     */
    includeViewObjectIds?: string[];

    /**
     * Ray-picking direction, used when {@link PickParams.rayPick} is ````true````.
     */
    direction?: math.FloatArrayParam;

    /**
     * Ray-picking origin, used when {@link PickParams.rayPick} is ````true````.
     */
    origin?: math.FloatArrayParam;

    /**
     * Ray-picking direction matrix, used when {@link PickParams.rayPick} is ````true````.
     */
    matrix?: math.FloatArrayParam;

    /**
     * Canvas coordinates, used when {@link PickParams.rayPick} is ````false````.
     */
    canvasPos?: math.FloatArrayParam;
}