import type {Vec3} from "@xeokit/sdk/base/math/vector";


/**
 * One candidate camera position inside a {@link SpaceGraphNode}.
 * Produced by a {@link ViewpointSampler}; consumed by the
 * {@link TourPlanner}, which picks one per visited space.
 *
 * `position` / `look` / `up` are full Camera state. Sampling the
 * graph and feeding the result straight into a `View.camera` (or
 * a `CameraFlightAnimation`) renders the viewpoint without
 * further interpretation.
 */
export interface ViewpointGraphNode {

  /** Unique node id within the parent {@link ViewpointGraph}. */
  id: string;

  /** {@link SpaceGraphNode.id} of the space this viewpoint belongs to. */
  spaceId: string;

  /** Camera eye position, world coords. */
  position: Vec3;

  /**
   * World-space point the camera looks at. Default samplers point the
   * camera toward the nearest exit door.
   */
  look: Vec3;

  /** Camera up vector, world coords. */
  up: Vec3;

  /**
   * Quality score in `[0, 1]`. Higher = better viewpoint. The
   * tour planner picks the highest-scoring viewpoint per visited
   * space.
   */
  score: number;

  /**
   * Fraction of the room's interior surface area visible from
   * this viewpoint, in `[0, 1]`. Optional — only the visibility-
   * grid sampler populates it; cheaper samplers leave it `undefined`.
   */
  visibilityCoverage?: number;
}
