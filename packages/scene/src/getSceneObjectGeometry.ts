import {SceneObject} from "./SceneObject";
import {Mesh} from "./Mesh";
import {decompressPositions} from "@xeokit/math/compression";
import {transformPositions3} from "@xeokit/math/matrix";
import {FloatArrayParam} from "@xeokit/math/math";
import {Geometry} from "./Geometry";
import {GeometryBucket} from "./GeometryBucket";
import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";

/**
 * The {@link getSceneObjectGeometry} passes an instance of GeometryView to its callback
 * for each {@link GeometryBucket} it visits. The GeometryView provides the SceneObject, Mesh, Geometry and
 * GeometryBucket at the current state of iteration, along with accessors through which the caller can
 * get various resources that the GeometryView lazy-computes on-demand, such as decompressed vertex positions, World-space
 * vertex positons, and decompressed vertex UV coordinates.
 */
export interface GeometryView {

    /**
     * The current {@link SceneObject}.
     */
    object: SceneObject;

    /**
     * The current {@link Mesh}.
     */
    mesh: Mesh;

    /**
     * The current {@link Mesh | Mesh's} position in {@link SceneModel.meshes | SceneObject.meshes}.
     */
    meshIndex: number;

    /**
     * The current {@link Geometry}.
     */
    geometry: Geometry;

    /**
     * The current {@link GeometryBucket}.
     */
    geometryBucket: GeometryBucket;

    /**
     * The current {@link GeometryBucket | GeometryBucket's} position in {@link Geometry.geometryBuckets | Geometry.geometryBuckets }.
     */
    geometryBucketIndex: number;

    /**
     * The total number of {@link GeometryBucket | GeometryBuckets} within the current {@link SceneObject}..
     */
    readonly totalGeometryBuckets: number;

    /**
     * The number of primitives in the current {@link GeometryBucket}.
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

class GeometryViewImpl implements GeometryView {

    object: SceneObject;
    mesh: Mesh;
    meshIndex: number;
    geometry: Geometry;
    geometryBucket: GeometryBucket;
    geometryBucketIndex: number;
    #positionsDecompressed: Float32Array;
    #positionsWorld: Float64Array;

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
        for (let i = 0, len = this.object.meshes.length; i < len; i++) {
            totalGeometryBuckets += this.object.meshes[i].geometry.geometryBuckets.length
        }
        return totalGeometryBuckets;
    }

    get numPrimitives() {
        const primitiveType = this.geometry.primitive;
        const elementsPerPrimitiveType = (primitiveType === TrianglesPrimitive ? 3 : (primitiveType === LinesPrimitive ? 2 : 1));
        return this.geometryBucket.indices.length / elementsPerPrimitiveType;
    }

    get positionsDecompressed(): FloatArrayParam {
        if (!this.#positionsDecompressed) {
            this.#positionsDecompressed = new Float32Array(this.geometryBucket.positionsCompressed.length);
            decompressPositions(this.geometryBucket.positionsCompressed, this.geometry.positionsDecompressMatrix, this.#positionsDecompressed);
        }
        return this.#positionsDecompressed;
    }

    get positionsWorld(): FloatArrayParam {
        if (!this.#positionsWorld) {
            const positionsDecompressed = this.positionsDecompressed;
            this.#positionsWorld = new Float64Array(positionsDecompressed.length);
            transformPositions3(positionsDecompressed, this.mesh.matrix, this.#positionsWorld);
        }
        return this.#positionsWorld;
    }

    get uvsDecompressed(): FloatArrayParam {
        return;
    }

    reset() {
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }
}

const geometryView = new GeometryViewImpl();

/**
 * Gets the uncompressed, World-space geometry of each {@link GeometryBucket} in each
 * {@link Geometry} in each {@link Mesh} in a {@link SceneObject}.
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
            if (withEachGeometry(geometryView)) {
                return true;
            }
        }
    }
    return false;
}
