import type {Vec3} from "@xeokit/sdk/base/math/vector";


/**
 * One discrete stop on a {@link CameraTour}. The full Camera
 * state (`position` / `look` / `up`), plus tour-level metadata
 * (dwell time, label, source space) so playback narration and
 * pickback to the source model work by default.
 *
 * Waypoints alternate between two roles in a played tour:
 *  - **In-space stops** — `spaceId` populated, camera dwells for
 *    `dwellMs`.
 *  - **Portal transits** — `spaceId === undefined`, generated
 *    automatically by the smoother on cross-portal edges so the
 *    camera crosses through the door instead of clipping the wall.
 */
export interface CameraTourWaypoint {

  /** Camera eye position, world coords. */
  position: Vec3;

  /** Camera look-at point, world coords. */
  look: Vec3;

  /** Camera up vector, world coords. */
  up: Vec3;

  /**
   * Id of the {@link SpaceGraphNode} the waypoint sits inside,
   * when the waypoint is an in-space stop. `undefined` for
   * portal-transit waypoints inserted by the smoother.
   *
   * Always present for in-space stops regardless of whether the
   * source space has a renderable SceneObject (synthesised
   * IfcSpaces and geometry-fallback rooms have none, but they
   * always have a SpaceGraphNode id) — use this as the
   * "is this a planned stop?" test in `onWaypointEnter`. To pick
   * back into the source model, use {@link dataObjectId} (IFC
   * GUID for IFC sources, undefined for geometry-fallback rooms).
   */
  spaceId?: string;

  /**
   * DataObject id of the space, e.g. an `IfcSpace` global id.
   * Same provenance as {@link SpaceGraphNode.dataObjectId}.
   */
  dataObjectId?: string;

  /**
   * Human-readable label inherited from the space, for narration
   * overlays / progress HUDs.
   */
  label?: string;

  /**
   * Milliseconds the playback engine should sit at this waypoint
   * before moving on. Defaults to {@link CameraTourPlanOptions.dwellMs}
   * on in-space stops; `0` on portal transits.
   */
  dwellMs?: number;

  /**
   * Optional per-waypoint vertical field-of-view override
   * (degrees). When `undefined`, playback keeps the View's
   * current FOV.
   */
  fovDeg?: number;
}
