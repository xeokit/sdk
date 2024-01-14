import type {SceneGeometry, SceneMesh} from "@xeokit/scene";
import type {GeometryBucketHit} from "./GeometryBucketHit";

/**
 * Represents an intersecting {@link @xeokit/scene!SceneMesh | SceneMesh} within a {@link RayPickResult}.
 *
 * See {@link "@xeokit/collision!pick"} for usage.
 */
export interface MeshHit {

    /**
     * The {@link @xeokit/scene!SceneMesh | SceneMesh} that was picked.
     */
    mesh: SceneMesh;

    /**
     * The {@link @xeokit/scene!SceneGeometry | SceneGeometry} belonging to the {@link @xeokit/scene!SceneMesh | SceneMesh} that was picked.
     */
    geometry: SceneGeometry;

    /**
     * Represents the intersecting {@link @xeokit/scene!SceneGeometryBucket | GeometryBuckets}
     * within the {@link @xeokit/scene!SceneGeometry | SceneGeometry} that is instanced by the {@link @xeokit/scene!SceneMesh | SceneMesh} that was picked.
     */
    geometryBucketHits: GeometryBucketHit[];
}