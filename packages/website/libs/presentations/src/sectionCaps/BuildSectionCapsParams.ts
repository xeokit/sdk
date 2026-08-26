import type {SceneModel, SceneObject} from "@xeokit/sdk/model/scene";
import type {Vec3} from "@xeokit/sdk/base/math/vector";
import type {CapPlane} from "./CapPlane";
import type {ProgressiveSpec} from "./ProgressiveSpec";

/**
 * Parameters for {@link buildSectionCaps}.
 */
export interface BuildSectionCapsParams {

  /**
   * Source {@link model!scene.SceneModel | SceneModel} whose
   * {@link model!scene.SceneObject | SceneObjects} are inspected for
   * triangles that straddle any of the supplied {@link capPlanes}.
   * Read-only — the function consumes its geometry but does not
   * mutate it.
   */
  sourceModel: SceneModel;

  /**
   * Caller-owned target {@link model!scene.SceneModel | SceneModel} into
   * which cap geometry is emitted. One
   * {@link model!scene.SceneObject | SceneObject} is created per source
   * object that has at least one cap, with one
   * {@link model!scene.SceneMesh | SceneMesh} per (source mesh, plane)
   * pair that produced a closed loop.
   *
   * May live in the same {@link model!scene.Scene | Scene} as
   * `sourceModel` or in a different one — the function only reads
   * source geometry and writes target components.
   *
   * The caller creates and destroys this SceneModel. On error,
   * partial state may have been written; the caller is
   * responsible for tearing it down if needed.
   */
  targetModel: SceneModel;

  /**
   * World-space planes to cut against. Each plane produces an
   * independent set of cap meshes per source object. Multi-plane
   * caps respect the union clip: a cap polygon on plane `A` is
   * itself trimmed against the kept half-space of every other
   * plane before triangulation.
   */
  capPlanes: ReadonlyArray<CapPlane>;

  /**
   * Optional RGB base colour applied to every emitted cap mesh's
   * material. When omitted, each cap inherits the corresponding
   * source mesh's effective colour (mesh `color` if present, else
   * the source material's `color`, else a neutral mid-grey
   * fallback). The renderer's body-hatch overlay (when the source
   * material carried a `hatchPattern`, copied through to the cap
   * material) tints from this base.
   */
  capColor?: Vec3;

  /**
   * Prefix used when minting target IDs. Defaults to `"cap"`. The
   * full pattern is:
   *
   * - Geometry / mesh: `"{idPrefix}__{sourceObjectId}__{sourceMeshId}__p{planeIndex}"`
   * - Material:        `"{idPrefix}__{sourceObjectId}__{sourceMeshId}__p{planeIndex}__mat"`
   * - Object:          `"{idPrefix}__{sourceObjectId}"`
   *
   * Pick a unique prefix when running the extractor multiple times
   * into the same target model (e.g. one prefix per pass / one per
   * cap-plane set).
   */
  idPrefix?: string;

  /**
   * Optional ViewLayer id assigned to every emitted
   * {@link model!scene.SceneObject | SceneObject}. Lets the host hide,
   * show, or style caps collectively via the named
   * {@link viewing!viewer.ViewLayer | ViewLayer} without touching the
   * source model. Omit to leave each emitted object on the target
   * SceneModel's default layer.
   */
  layerId?: string;

  /**
   * Optional whitelist of source SceneObject ids to consider. When
   * supplied, only objects whose id is in this collection are
   * capped; everything else is skipped. Accepts an array or a
   * `Set` (prefer `Set` for very large filter lists — membership
   * is O(1)). Combines with {@link excludeObjectIds} and
   * {@link includeObject} via AND.
   */
  includeObjectIds?: ReadonlyArray<string> | ReadonlySet<string>;

  /**
   * Optional blacklist of source SceneObject ids to skip. When
   * supplied, objects whose id is in this collection are not
   * capped. Combines with {@link includeObjectIds} and
   * {@link includeObject} via AND.
   */
  excludeObjectIds?: ReadonlyArray<string> | ReadonlySet<string>;

  /**
   * Optional predicate run once per candidate source SceneObject.
   * Return `true` to keep the object in the capping set, `false`
   * to skip. Combines with {@link includeObjectIds} and
   * {@link excludeObjectIds} via AND — all three must pass.
   *
   * Useful for filters that don't reduce to a static id list:
   * "whatever's visible in this View", "whatever matches this
   * schema query", "anything not in a hidden set".
   */
  includeObject?: (sourceObject: SceneObject) => boolean;

  /**
   * Yield to the host between batches of per-source-object
   * createObject calls so the extractor paints progressively
   * instead of blocking the main thread. Pass `true` for defaults
   * (50 objects per batch, RAF-driven yields), or a
   * {@link ProgressiveSpec} for finer control. Default `false`
   * — synchronous, no yields.
   *
   * When enabled, the function still returns a single
   * {@link base!core.SDKResult | SDKResult} but only after the last
   * source object has been processed. If the target SceneModel
   * is destroyed mid-flight (e.g. the caller's teardown ran while
   * a yield was outstanding), the function bails cleanly on the
   * next batch boundary.
   */
  progressive?: boolean | ProgressiveSpec;
}
