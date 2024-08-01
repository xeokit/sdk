import type {SceneObject} from "./SceneObject";
import type {SceneMesh} from "./SceneMesh";
import {decompressPositions3WithAABB3} from "@xeokit/compression";
import {transformPositions3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import type {SceneGeometry} from "./SceneGeometry";
import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/constants";

/**
 * The {@link getSceneObjectGeometry} passes an instance of GeometryView to its callback
 * for each {@link @xeokit/scene!SceneGeometry} it visits.
 *
 * The GeometryView provides the SceneObject, SceneMesh and SceneGeometry at the current state
 * of iteration, along with accessors through which the caller can
 * get various resources that the GeometryView lazy-computes on-demand, such as decompressed vertex positions, World-space
 * vertex positons, and decompressed vertex UV coordinates.
 */
export interface GeometryView {

    /**
     * The current {@link @xeokit/scene!SceneObject}.
     */
    object: SceneObject;

    /**
     * The current {@link @xeokit/scene!SceneMesh}.
     */
    mesh: SceneMesh;

    /**
     * The current {@link @xeokit/scene!SceneMesh | SceneMesh's} position in {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}.
     */
    meshIndex: number;

    /**
     * The current {@link @xeokit/scene!SceneGeometry}.
     */
    geometry: SceneGeometry;

    /**
     * The number of primitives in the current {@link @xeokit/scene!SceneGeometry}.
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

class GeometryViewImpl {

    object: SceneObject | null;
    mesh: SceneMesh | null;
    meshIndex: number;
    geometry: SceneGeometry | null;

    #positionsDecompressed: Float32Array | null;
    #positionsWorld: Float64Array | null;

    constructor() {
        this.object = null;
        this.mesh = null;
        this.meshIndex = 0;
        this.geometry = null;
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }

    get numPrimitives() {
        const primitiveType = (<SceneGeometry>this.geometry).primitive;
        const elementsPerPrimitiveType = (primitiveType === TrianglesPrimitive ? 3 : (primitiveType === LinesPrimitive ? 2 : 1));
        return this.geometry.indices.length / elementsPerPrimitiveType;
    }

    get positionsDecompressed(): FloatArrayParam {
        if (!this.#positionsDecompressed) {
            this.#positionsDecompressed = new Float32Array((<SceneGeometry>this.geometry).positionsCompressed.length);
            decompressPositions3WithAABB3((<SceneGeometry>this.geometry).positionsCompressed, (<SceneGeometry>this.geometry).aabb, this.#positionsDecompressed);
        }
        return this.#positionsDecompressed;
    }

    get positionsWorld(): FloatArrayParam {
        if (!this.#positionsWorld) {
            const positionsDecompressed = this.positionsDecompressed;
            this.#positionsWorld = new Float64Array(positionsDecompressed.length);
            transformPositions3(positionsDecompressed, (<SceneMesh>this.mesh).matrix, this.#positionsWorld);
        }
        return this.#positionsWorld;
    }

    get uvsDecompressed(): FloatArrayParam | null{
        return null;
    }

    reset() {
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }
}

const geometryView = new GeometryViewImpl();

/**
 * Gets the uncompressed, World-space geometry of each {@link @xeokit/scene!SceneGeometryBucket} in each
 * {@link @xeokit/scene!SceneGeometry} in each {@link @xeokit/scene!SceneMesh} in a {@link @xeokit/scene!SceneObject}.
 *
 * If the callback returns ````true````, then this method immediately stops iterating and also returns ````true````.
 *
 * @param sceneObject
 * @param withEachGeometry
 */
export function getSceneObjectGeometry(sceneObject: SceneObject, withEachGeometry: (geometryView: GeometryView) => boolean): boolean {
    // geometryView.reset();
    // geometryView.object = sceneObject;
    // for (let i = 0, len = sceneObject.meshes.length; i < len; i++) {
    //     const mesh = sceneObject.meshes[i];
    //     geometryView.mesh = mesh;
    //     geometryView.meshIndex = i;
    //     const geometry = mesh.geometry;
    //     geometryView.geometry = geometry;
    //     for (let j = 0, lenj = geometry.geometryBuckets.length; j < lenj; j++) {
    //         geometryView.geometryBucket = geometry.geometryBuckets[j];
    //         geometryView.geometryBucketIndex = j;
    //         if (withEachGeometry(<GeometryView>geometryView)) {
    //             return true;
    //         }
    //     }
    // }
    return false;
}
