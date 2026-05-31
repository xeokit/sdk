/**
 * Message protocol between the main thread and the culling worker.
 *
 * The worker mirrors one bounding **sphere** per scene object, keyed by a
 * dense integer index (small messages, since real BIM scenes have millions of
 * objects with string ids). It holds cull state independently per view, so a
 * single worker + a single bounds mirror serve every {@link View} of a Scene.
 *
 * All world-space numeric payloads are `Float64Array`, because the SDK works
 * in 64-bit world coordinates — culling a geolocated model at the f32 origin
 * would mis-test by metres.
 */

/**
 * Adds or updates a batch of mirrored items and/or removes items.
 *
 * The three per-item arrays are parallel: item `k` has dense index
 * `indices[k]`, centre `centers[k*3 .. k*3+2]`, radius `radii[k]`, and the
 * `cullable[k]` flag (1 or 0). Their backing buffers are posted as
 * transferables — the main thread rebuilds them on the next marshal.
 *
 * There is deliberately no per-item visibility here: visibility is a
 * per-{@link View} property ({@link ViewObject.visible}), so it can't live in
 * a per-Scene mirror, and the renderer already skips invisible objects
 * regardless of their cull flag.
 */
export interface UpdateItemsMessage {
  type: "UpdateItems";
  indices: number[];
  centers: Float64Array<any>;
  radii: Float64Array<any>;
  cullable: Uint8Array<any>;
  removed: number[];
}

/**
 * Updates one view's camera and triggers a cull pass for that view.
 *
 * `planes` is six normalized frustum planes packed as `[nx, ny, nz, offset]`
 * (24 floats), matching {@link FrustumPlane3}: a point is inside plane `i`
 * when `nx*x + ny*y + nz*z + offset >= 0`. `eye` is the camera world position,
 * used for the distance-based solid-angle and too-close tests.
 */
export interface ViewChangedMessage {
  type: "ViewChanged";
  viewId: string;
  planes: Float64Array<any>;
  eye: Float64Array<any>;
  solidAngleLimit: number;
}

/**
 * Drops all cull state the worker holds for a view (the view was destroyed or
 * disabled culling).
 */
export interface RemoveViewMessage {
  type: "RemoveView";
  viewId: string;
}

/**
 * Any message the main thread sends to the worker.
 */
export type CullingInputMessage =
  | UpdateItemsMessage
  | ViewChangedMessage
  | RemoveViewMessage;

/**
 * The delta produced by a cull pass for one view: the item indices whose cull
 * state flipped since the previous pass. Only flips are sent, so a settled
 * camera produces empty deltas (reported as {@link DoneMessage} instead).
 */
export interface CullResultsMessage {
  type: "CullResults";
  viewId: string;
  newlyCulled: number[];
  newlyUnCulled: number[];
}

/**
 * Signals that a pass completed with no cull-state changes. Used mainly so
 * callers (and tests) can observe that the worker has caught up.
 */
export interface DoneMessage {
  type: "Done";
  viewId: string;
}

/**
 * Any message the worker sends back to the main thread.
 */
export type CullingOutputMessage = CullResultsMessage | DoneMessage;

/**
 * The `postMessage` signature the worker kernel calls to emit results. Kept
 * narrow so the kernel can be driven directly in unit tests without a real
 * {@link Worker}.
 */
export type PostCullingMessage = (message: CullingOutputMessage) => void;
