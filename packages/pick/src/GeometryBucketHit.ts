import type {SceneGeometryBucket} from "@xeokit/scene";
import type {PrimHit} from "./PrimHit";

/**
 * Represents an intersecting {@link @xeokit/scene!SceneGeometryBucket | SceneGeometryBucket} within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface GeometryBucketHit {

    /**
     * The {@link @xeokit/scene!SceneGeometryBucket | SceneGeometryBucket} that was picked.
     */
    geometryBucket: SceneGeometryBucket;

    /**
     * Represents the primitives (triangles, lines, or points) within the picked {@link @xeokit/scene!SceneObject | SceneObject} that intersect the picking ray.
     */
    primHits: PrimHit[];
}