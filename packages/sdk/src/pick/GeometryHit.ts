import type { SceneGeometry } from "../scene";
import type { PrimHit } from "./PrimHit";

/**
 * Represents an intersecting {@link scene!SceneGeometry | SceneGeometry} within a {@link RayPickResult}.
 *
 * See {@link pick | @xeokit/sdk/pick} for usage.
 */
export interface GeometryHit {

  /**
     * The {@link scene!SceneGeometryBucket | SceneGeometryBucket} that was picked.
     */
  geometry: SceneGeometry;

  /**
     * Represents the primitives (triangles, lines, or points) within the picked {@link scene!SceneObject | SceneObject} that intersect the picking ray.
     */
  primHits: PrimHit[];
}
