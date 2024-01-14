import type {SceneObject} from "./SceneObject";
import type {SceneMesh} from "./SceneMesh";
import {decompressPositions3} from "@xeokit/compression";
import {transformPositions3} from "@xeokit/matrix";
import type {FloatArrayParam} from "@xeokit/math";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneGeometryBucket} from "./SceneGeometryBucket";
import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/constants";

/**
 * The {@link getSceneObjectGeometry} passes an instance of GeometryView to its callback
 * for each {@link @xeokit/scene!SceneGeometryBucket} it visits. The GeometryView provides the SceneObject, SceneMesh, SceneGeometry and
 * SceneGeometryBucket at the current state of iteration, along with accessors through which the caller can
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
     * The current {@link @xeokit/scene!SceneGeometryBucket}.
     */
    geometryBucket: SceneGeometryBucket;

    /**
     * The current {@link @xeokit/scene!SceneGeometryBucket | SceneGeometryBucket's} position in {@link @xeokit/scene!SceneGeometry.geometryBuckets | SceneGeometry.geometryBuckets }.
     */
    geometryBucketIndex: number;

    /**
     * The total number of {@link @xeokit/scene!SceneGeometryBucket | GeometryBuckets} within the current {@link @xeokit/scene!SceneObject}.
     */
    readonly totalGeometryBuckets: number;

    /**
     * The number of primitives in the current {@link @xeokit/scene!SceneGeometryBucket}.
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
    geometryBucket: SceneGeometryBucket | null;
    geometryBucketIndex: number;
    #positionsDecompressed: Float32Array | null;
    #positionsWorld: Float64Array | null;

    constructor() {
        this.object = null;
        this.mesh = null;
        this.meshIndex = 0;
        this.geometry = null;
        this.geometryBucket = null;
        this.geometryBucketIndex = 0;
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }

    get totalGeometryBuckets() {
        let totalGeometryBuckets = 0;
        if (this.object) {
            for (let i = 0, len = this.object.meshes.length; i < len; i++) {
                totalGeometryBuckets += this.object.meshes[i].geometry.geometryBuckets.length;
            }
        }
        return totalGeometryBuckets;
    }

    get numPrimitives() {
        const primitiveType = (<SceneGeometry>this.geometry).primitive;
        const elementsPerPrimitiveType = (primitiveType === TrianglesPrimitive ? 3 : (primitiveType === LinesPrimitive ? 2 : 1));
        return (<FloatArrayParam>(<SceneGeometryBucket>this.geometryBucket).indices).length / elementsPerPrimitiveType;
    }

    get positionsDecompressed(): FloatArrayParam {
        if (!this.#positionsDecompressed) {
            this.#positionsDecompressed = new Float32Array((<SceneGeometryBucket>this.geometryBucket).positionsCompressed.length);
            decompressPositions3((<SceneGeometryBucket>this.geometryBucket).positionsCompressed, (<SceneGeometry>this.geometry).positionsDecompressMatrix, this.#positionsDecompressed);
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
    geometryView.reset();
    geometryView.object = sceneObject;
    for (let i = 0, len = sceneObject.meshes.length; i < len; i++) {
        const mesh = sceneObject.meshes[i];
        geometryView.mesh = mesh;
        geometryView.meshIndex = i;
        const geometry = mesh.geometry;
        geometryView.geometry = geometry;
        for (let j = 0, lenj = geometry.geometryBuckets.length; j < lenj; j++) {
            geometryView.geometryBucket = geometry.geometryBuckets[j];
            geometryView.geometryBucketIndex = j;
            if (withEachGeometry(<GeometryView>geometryView)) {
                return true;
            }
        }
    }
    return false;
}
