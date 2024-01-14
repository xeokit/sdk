import type {PickResult} from "@xeokit/viewer";
import type {SceneObject} from "@xeokit/scene";

/**
 * Meshes that can be picked by a WebGLRenderer.
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
     * @param {PickResult} pickResult The PickResult to augment with pick intersection information specific to this SceneMesh.
     * @param [pickResult.primIndex] Index of the primitive that was picked on this SceneMesh.
     * @param [pickResult.canvasPos] View coordinates, provided when picking through the View.
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
}
