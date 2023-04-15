import {Geometry, GeometryBucket, Mesh, SceneObject} from "@xeokit/scene";
import {KdLinePrim, KdPointPrim, KdTrianglePrim} from "../kdtree3d";
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
    geometryBucketHits: GeometryBucketHit[];
}

/**
 * TODO
 */
export interface GeometryBucketHit {

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
    prim: (KdTrianglePrim | KdLinePrim | KdPointPrim);

    /**
     * TODO
     */
    worldPos: FloatArrayParam;
}