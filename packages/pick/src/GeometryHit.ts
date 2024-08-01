import type {SceneGeometry} from "@xeokit/scene";
import type {PrimHit} from "./PrimHit";

/**
 * Represents an intersecting {@link @xeokit/scene!SceneGeometry | SceneGeometry} within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface GeometryHit {

    /**
     * The {@link @xeokit/scene!SceneGeometryBucket | SceneGeometryBucket} that was picked.
     */
    geometry: SceneGeometry;

    /**
     * Represents the primitives (triangles, lines, or points) within the picked {@link @xeokit/scene!SceneObject | SceneObject} that intersect the picking ray.
     */
    primHits: PrimHit[];
}
