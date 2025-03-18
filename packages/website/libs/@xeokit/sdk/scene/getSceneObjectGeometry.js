import { decompressPositions3WithAABB3 } from "../compression";
import { transformPositions3 } from "../matrix";
import { LinesPrimitive, TrianglesPrimitive } from "../constants";
class GeometryViewImpl {
    object;
    mesh;
    meshIndex;
    geometry;
    #positionsDecompressed;
    #positionsWorld;
    constructor() {
        this.object = null;
        this.mesh = null;
        this.meshIndex = 0;
        this.geometry = null;
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }
    get numPrimitives() {
        const primitiveType = this.geometry.primitive;
        const elementsPerPrimitiveType = (primitiveType === TrianglesPrimitive ? 3 : (primitiveType === LinesPrimitive ? 2 : 1));
        return this.geometry.indices.length / elementsPerPrimitiveType;
    }
    get positionsDecompressed() {
        if (!this.#positionsDecompressed) {
            this.#positionsDecompressed = new Float32Array(this.geometry.positionsCompressed.length);
            decompressPositions3WithAABB3(this.geometry.positionsCompressed, this.geometry.aabb, this.#positionsDecompressed);
        }
        return this.#positionsDecompressed;
    }
    get positionsWorld() {
        if (!this.#positionsWorld) {
            const positionsDecompressed = this.positionsDecompressed;
            this.#positionsWorld = new Float64Array(positionsDecompressed.length);
            transformPositions3(positionsDecompressed, this.mesh.matrix, this.#positionsWorld);
        }
        return this.#positionsWorld;
    }
    get uvsDecompressed() {
        return null;
    }
    reset() {
        this.#positionsDecompressed = null;
        this.#positionsWorld = null;
    }
}
const geometryView = new GeometryViewImpl();
/**
 * Gets the uncompressed, World-space geometry of each {@link scene!SceneGeometryBucket} in each
 * {@link scene!SceneGeometry | SceneGeometry} in each {@link scene!SceneMesh} in a {@link scene!SceneObject}.
 *
 * If the callback returns ````true````, then this method immediately stops iterating and also returns ````true````.
 *
 * @param sceneObject
 * @param withEachGeometry
 */
export function getSceneObjectGeometry(sceneObject, withEachGeometry) {
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
//# sourceMappingURL=getSceneObjectGeometry.js.map
