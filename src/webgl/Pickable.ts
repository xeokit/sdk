import {PickResult, SceneObject, math} from "../viewer/index";

import {RenderContext} from "./RenderContext";

/**
 * Meshes that can be picked by a webgl.
 *
 * @private
 */
export interface Pickable {

    /**
     * Called by xeokit to get if it's possible to pick a triangle on the surface of this Drawable.
     */
    canPickTriangle(): boolean,

    /**
     * Picks a triangle on this Pickable.
     */
    //drawPickTriangles(drawFlags: DrawFlags, renderContext: RenderContext): void;

    /**
     * Given a {@link PickResult} that contains a {@link PickResult#primIndex}, which indicates that a primitive was picked on the Pickable, then add more information to the PickResult about the picked position on the surface of the Pickable.
     *
     * Architecturally, this delegates collection of that Pickable-specific info to the Pickable, allowing it to provide whatever info it's able to.
     *
     * @param {PickResult} pickResult The PickResult to augment with pick intersection information specific to this Mesh.
     * @param [pickResult.primIndex] Index of the primitive that was picked on this Mesh.
     * @param [pickResult.canvasPos] Canvas coordinates, provided when picking through the Canvas.
     * @param [pickResult.origin] World-space 3D ray origin, when ray picking.
     * @param [pickResult.direction] World-space 3D ray direction, provided when ray picking.
     */
    pickTriangleSurface(pickResult: PickResult): void;

    /**
     * Called by xeokit to get if it's possible to pick a 3D point on the surface of this Pickable.
     * Returns false if canPickTriangle returns true, and vice-versa.
     */
    canPickWorldPos(): boolean;

   // drawPickDepths(drawFlags: DrawFlags, renderContext: RenderContext): void;

    delegatePickedEntity(): SceneObject;

    /**
     * 3D origin of the Pickable's vertex positions, if they are in relative-to-center (RTC) coordinates.
     * When this is defined, then the positions are RTC, which means that they are relative to this position.
     */
    get origin(): math.FloatArrayParam;
}
