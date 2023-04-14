import {Geometry, GeometryBucket, Mesh, SceneObject} from "@xeokit/scene";
import {KdLine3D, KdPoint3D, KdTriangle3D} from "../kdtree3d";
import {FloatArrayParam} from "@xeokit/math/math";

/**
 * Results returned by {@link rayPick}.
 */
export interface RayPickResult {

    /**
     * Contains the primitives that were ray-picked, including the hierarchy of scene elements
     * that contain the primitives.
     */
    sceneObjectHits: SceneObjectHit[]
}


/**
 * TODO
 */
export interface SceneObjectHit {

    /**
     * The {@link @xeokit/scene!SceneObject} that was hit.
     */
    sceneObject: SceneObject;

    /**
     * TODO
     */
    meshHits: MeshHit[];
}

/**
 * TODO
 */
export interface MeshHit {

    /**
     * TODO
     */
    mesh: Mesh;

    /**
     * TODO
     */
    geometry: Geometry;

    /**
     * TODO
     */
    geometryBucketHits: GeometryBucketPickHit[];
}

/**
 * TODO
 */
export interface GeometryBucketPickHit {

    /**
     * TODO
     */
    geometryBucket: GeometryBucket;

    /**
     * TODO
     */
    primHits: PrimHit[];
}

/**
 * TODO
 */
export interface PrimHit {
    /**
     * TODO
     */
    primitive: (KdTriangle3D | KdLine3D | KdPoint3D);

    /**
     * TODO
     */
    worldPos: FloatArrayParam;
}