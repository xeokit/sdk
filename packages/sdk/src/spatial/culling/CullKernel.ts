import type {
  CullingInputMessage,
  CullResultsMessage,
  PostCullingMessage
} from "./CullingProtocol";

/**
 * The cull state and bounds mirror for the culling worker, plus the single
 * entry point that drives them.
 */
export interface CullKernel {

  /**
   * Processes one inbound message and emits results via `post`.
   *
   * @param message - A message from the main thread.
   * @param post - Called with the per-view delta (or a `Done` when nothing
   * changed).
   */
  handleMessage(message: CullingInputMessage, post: PostCullingMessage): void;
}

/**
 * Builds a {@link CullKernel}: the frustum + solid-angle culling algorithm,
 * a bounds mirror (one sphere per object), and per-view cull state.
 *
 * **This function is intentionally self-contained.** It declares every helper
 * and all state inside its own body and closes over nothing from module scope.
 * That lets {@link createCullingWorker} stringify it with `Function.toString()`
 * and run it inside a Blob worker — the only worker-loading mechanism that
 * works across every consumer bundler (this SDK is bundled by esbuild, which
 * does not transform the `new Worker(new URL(...))` pattern). The same factory
 * is driven directly in unit tests, so the algorithm is verified without a
 * real {@link Worker}.
 *
 * Do not introduce imports or module-scope references into the body — only
 * type-only references (erased at compile time) are safe.
 */
export function createCullKernel(): CullKernel {

  // Bounds mirror, indexed by dense item index. Parallel arrays keep the
  // per-item footprint flat for very large scenes.
  const present: boolean[] = [];
  const cx: number[] = [];
  const cy: number[] = [];
  const cz: number[] = [];
  const radius: number[] = [];
  const cullable: boolean[] = [];

  // Per-view cull state. One bounds mirror feeds many views because a Viewer
  // drives several Views over one Scene, each with its own camera.
  interface ViewState {
    planes: Float64Array | null; // 6 planes packed [nx,ny,nz,offset]
    eye: Float64Array | null;    // camera world position
    solidAngleLimit: number;
    culled: boolean[];           // by item index
    ready: boolean;              // has a camera been received yet?
  }
  const views = new Map<string, ViewState>();

  const getView = (viewId: string): ViewState => {
    let view = views.get(viewId);
    if (!view) {
      view = {planes: null, eye: null, solidAngleLimit: 0, culled: [], ready: false};
      views.set(viewId, view);
    }
    return view;
  };

  // Decides whether item `index` should be culled in `view`. Three tests in
  // order: keep items the camera is inside, cull items below the solid-angle
  // limit, then cull items fully outside the frustum.
  const shouldCull = (view: ViewState, index: number): boolean => {
    const r = radius[index];
    const ex = view.eye![0], ey = view.eye![1], ez = view.eye![2];
    const dx = cx[index] - ex, dy = cy[index] - ey, dz = cz[index] - ez;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Camera is inside the bounding sphere — always keep.
    if (dist < r) {
      return false;
    }

    // Size cull: the object subtends too small an angle on screen.
    // Resolution-independent, so it behaves the same across canvas sizes.
    if (view.solidAngleLimit > 0) {
      const ratio = r / dist;
      const solidAngle = Math.asin(ratio < 1 ? ratio : 1);
      if (solidAngle < view.solidAngleLimit) {
        return true;
      }
    }

    // Frustum cull: outside if the sphere is fully behind any one plane.
    // Planes are normalized, so the signed distance is in world units and the
    // sphere clears the plane when that distance drops below -radius.
    const p = view.planes!;
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      const signedDist = p[o] * cx[index] + p[o + 1] * cy[index] + p[o + 2] * cz[index] + p[o + 3];
      if (signedDist < -r) {
        return true;
      }
    }

    return false;
  };

  // Re-evaluates one item for one view, recording any cull-state flip.
  const recheck = (view: ViewState, index: number, delta: CullResultsMessage): void => {
    if (!present[index]) {
      return;
    }
    const target = cullable[index] ? shouldCull(view, index) : false;
    const current = view.culled[index] || false;
    if (target === current) {
      return;
    }
    view.culled[index] = target;
    if (target) {
      delta.newlyCulled.push(index);
    } else {
      delta.newlyUnCulled.push(index);
    }
  };

  const emit = (post: PostCullingMessage, delta: CullResultsMessage): void => {
    if (delta.newlyCulled.length > 0 || delta.newlyUnCulled.length > 0) {
      post(delta);
    } else {
      post({type: "Done", viewId: delta.viewId});
    }
  };

  const handleMessage = (message: CullingInputMessage, post: PostCullingMessage): void => {
    switch (message.type) {

      case "UpdateItems": {
        const {indices, centers, radii, cullable: cullableFlags, removed} = message;
        // Removes first, so an index freed and reused in the same batch ends
        // up present (the add below wins).
        for (let k = 0; k < removed.length; k++) {
          const index = removed[k];
          present[index] = false;
          views.forEach((view) => {
            view.culled[index] = false;
          });
        }
        for (let k = 0; k < indices.length; k++) {
          const index = indices[k];
          present[index] = true;
          cx[index] = centers[k * 3];
          cy[index] = centers[k * 3 + 1];
          cz[index] = centers[k * 3 + 2];
          radius[index] = radii[k];
          cullable[index] = cullableFlags[k] !== 0;
        }
        // Re-check only the touched items, for each view that has a camera.
        views.forEach((view, viewId) => {
          if (!view.ready) {
            return;
          }
          const delta: CullResultsMessage = {type: "CullResults", viewId, newlyCulled: [], newlyUnCulled: []};
          for (let k = 0; k < indices.length; k++) {
            recheck(view, indices[k], delta);
          }
          emit(post, delta);
        });
        break;
      }

      case "ViewChanged": {
        const view = getView(message.viewId);
        view.planes = message.planes;
        view.eye = message.eye;
        view.solidAngleLimit = message.solidAngleLimit;
        view.ready = true;
        const delta: CullResultsMessage = {
          type: "CullResults",
          viewId: message.viewId,
          newlyCulled: [],
          newlyUnCulled: []
        };
        for (let index = 0; index < present.length; index++) {
          if (present[index]) {
            recheck(view, index, delta);
          }
        }
        emit(post, delta);
        break;
      }

      case "RemoveView": {
        views.delete(message.viewId);
        break;
      }
    }
  };

  return {handleMessage};
}
