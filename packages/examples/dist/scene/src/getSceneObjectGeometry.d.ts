import type { SceneObject } from "./SceneObject";
import type { Mesh } from "./Mesh";
import type { FloatArrayParam } from "@xeokit/math";
import type { Geometry } from "./Geometry";
import type { GeometryBucket } from "./GeometryBucket";
/**
 * The {@link getSceneObjectGeometry} passes an instance of GeometryView to its callback
 * for each {@link @xeokit/scene!GeometryBucket} it visits. The GeometryView provides the SceneObject, Mesh, Geometry and
 * GeometryBucket at the current state of iteration, along with accessors through which the caller can
 * get various resources that the GeometryView lazy-computes on-demand, such as decompressed vertex positions, World-space
 * vertex positons, and decompressed vertex UV coordinates.
 */
export interface GeometryView {
    /**
     * The current {@link @xeokit/scene!SceneObject}.
     */
    object: SceneObject;
    /**
     * The current {@link @xeokit/scene!Mesh}.
     */
    mesh: Mesh;
    /**
     * The current {@link @xeokit/scene!Mesh | Mesh's} position in {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}.
     */
    meshIndex: number;
    /**
     * The current {@link @xeokit/scene!Geometry}.
     */
    geometry: Geometry;
    /**
     * The current {@link @xeokit/scene!GeometryBucket}.
     */
    geometryBucket: GeometryBucket;
    /**
     * The current {@link @xeokit/scene!GeometryBucket | GeometryBucket's} position in {@link @xeokit/scene!Geometry.geometryBuckets | Geometry.geometryBuckets }.
     */
    geometryBucketIndex: number;
    /**
     * The total number of {@link @xeokit/scene!GeometryBucket | GeometryBuckets} within the current {@link @xeokit/scene!SceneObject}.
     */
    readonly totalGeometryBuckets: number;
    /**
     * The number of primitives in the current {@link @xeokit/scene!GeometryBucket}.
     */
    readonly numPrimitives: number;
    /**
     * The current 3D vertex positions, dequantized, as 32-bit floats.
     */
    readonly positionsDecompressed: FloatArrayParam;
    /**
     * The current 3D World-space vertex positions, dequantized and world-transformed, as 64-bit floats.
     */
    readonly positionsWorld: FloatArrayParam;
    /**
     * The current vertex UV coordinates, if any, dequantized to 32-bit floats.
     */
    readonly uvsDecompressed: FloatArrayParam;
}
/**
 * Gets the uncompressed, World-space geometry of each {@link @xeokit/scene!GeometryBucket} in each
 * {@link @xeokit/scene!Geometry} in each {@link @xeokit/scene!Mesh} in a {@link @xeokit/scene!SceneObject}.
 *
 * If the callback returns ````true````, then this method immediately stops iterating and also returns ````true````.
 *
 * @param sceneObject
 * @param withEachGeometry
 */
export declare function getSceneObjectGeometry(sceneObject: SceneObject, withEachGeometry: (geometryView: GeometryView) => boolean): boolean;
