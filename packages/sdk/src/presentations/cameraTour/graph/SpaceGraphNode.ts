import type {AABB3} from "../../../base/math/boundaries";
import type {Vec3} from "../../../base/math/vector";

import type {SpaceGraphEdge} from "./SpaceGraphEdge";


/**
 * One traversable space ("room") in the building. Produced by a
 * {@link SpaceExtractor} — typically from an `IfcSpace` for IFC
 * sources, or from horizontal-slab clustering for the geometry
 * fallback.
 *
 * Carries the world-space bounds the viewpoint sampler operates
 * inside, the floor elevation the camera should rest above, and
 * back-references to the source SceneObject / DataObject for
 * pick-back and label resolution.
 */
export interface SpaceGraphNode {

  /** Unique node id within the parent {@link SpaceGraph}. */
  id: string;

  /** World-space AABB of the space's volume. */
  aabb: AABB3;

  /** World-space centroid — the default "centre of the room" viewpoint anchor. */
  centroid: Vec3;

  /**
   * World-space floor elevation. Used by the sampler to place the
   * camera eye `options.eyeHeight` units above the floor instead
   * of at room-centroid altitude. Coordinate depends on the
   * scene's `worldUp`.
   */
  floorElevation: number;

  /** SceneObject id backing this space, if one exists. */
  sceneObjectId?: string;

  /** DataObject id, e.g. an `IfcSpace` global id. */
  dataObjectId?: string;

  /**
   * Human-readable label — typically `IfcSpace.LongName` or
   * `.Name`. Surfaced on the corresponding
   * {@link CameraTourWaypoint.label} for narration overlays.
   */
  label?: string;

  /**
   * Edges (portals to adjacent spaces) incident on this node.
   * Same instances as in {@link SpaceGraph.edges}; duplicated as a
   * back-reference for cheap adjacency lookups.
   */
  edges: ReadonlyArray<SpaceGraphEdge>;
}
