import type {Vec3} from "@xeokit/sdk/base/math/vector";


/**
 * Portal (door, opening, or generic transition) between two
 * adjacent {@link SpaceGraphNode}s. Carries the world-space
 * mid-point of the portal plus the through-direction so the
 * tour planner can build cross-portal camera trajectories that
 * thread the door rather than clip into the surrounding wall.
 *
 * For IFC sources, `dataObjectId` typically references an
 * `IfcDoor` or `IfcOpeningElement`. For the geometry fallback
 * extractor, edges are synthesised from wall-aperture detection
 * and `dataObjectId` is omitted.
 */
export interface SpaceGraphEdge {

  /** Unique edge id within the parent {@link SpaceGraph}. */
  id: string;

  /** {@link SpaceGraphNode.id} of one of the two adjacent spaces. */
  from: string;

  /** {@link SpaceGraphNode.id} of the other adjacent space. */
  to: string;

  /** World-space mid-point of the portal opening. */
  position: Vec3;

  /**
   * Unit normal pointing from `from` toward `to`. Used by samplers
   * to bias viewpoint look-direction toward the exit door, and by
   * the tour planner to orient mid-portal flight tangents.
   */
  normal: Vec3;

  /** Portal width in world units, if known. */
  width?: number;

  /** Portal height in world units, if known. */
  height?: number;

  /** SceneObject id backing the portal (e.g. the door's SceneObject). */
  sceneObjectId?: string;

  /** DataObject id, e.g. an `IfcDoor` global id. */
  dataObjectId?: string;
}
