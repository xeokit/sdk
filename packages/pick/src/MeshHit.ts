import {Geometry, Mesh} from "@xeokit/scene";
import {GeometryBucketHit} from "./GeometryBucketHit";

/**
 * Represents an intersecting {@link @xeokit/scene!Mesh | Mesh} within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision/pick"} for usage.
 */
export interface MeshHit {

    /**
     * The {@link @xeokit/scene!Mesh | Mesh} that was picked.
     */
    mesh: Mesh;

    /**
     * The {@link @xeokit/scene!Geometry | Geometry} belonging to the {@link @xeokit/scene!Mesh | Mesh} that was picked.
     */
    geometry: Geometry;

    /**
     * Represents the intersecting {@link @xeokit/scene!GeometryBucket | GeometryBuckets}
     * within the {@link @xeokit/scene!Geometry | Geometry} that is instanced by the {@link @xeokit/scene!Mesh | Mesh} that was picked.
     */
    geometryBucketHits: GeometryBucketHit[];
}