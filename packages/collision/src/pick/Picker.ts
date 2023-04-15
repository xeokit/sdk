import {
    createPrimsKdTree3D,
    KdLinePrim,
    KdPointPrim,
    KdTrianglePrim,
    SceneObjectsKdTree3D,
    searchKdTree3DWithFrustum,
    searchKdTree3DWithRay
} from "@xeokit/collision/kdtree3d";
import {FloatArrayParam} from "@xeokit/math/math";
import {RayPickResult} from "./RayPickResult";
import {MarqueePickResult} from "./MarqueePickResult";
import {PickPrimsCache} from "./PickPrimsCache";
import {decompressPositions3} from "@xeokit/math/compression";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";
import {Geometry, GeometryBucket} from "@xeokit/scene";

/** TODO
 *
 */
export class Picker {

    #pickPrimsCache: PickPrimsCache;

    constructor() {
        this.#pickPrimsCache = new PickPrimsCache();
    }

    /**
     * TODO
     * @param params
     */
    rayPick(params: {
        sceneObjectsKdTree3D: SceneObjectsKdTree3D,
        origin: FloatArrayParam,
        dir: FloatArrayParam
    }): RayPickResult {

        //
        // Cache for different Scene's?
        //

        const sceneObjectsKdTree3D = params.sceneObjectsKdTree3D;
        const origin = params.origin;
        const dir = params.dir;
        const rayPickResult = <RayPickResult>{
            sceneObjectHits: []
        };
        const kdItems = searchKdTree3DWithRay({kdTree: sceneObjectsKdTree3D, origin, dir});
        for (let i = 0, len = kdItems.length; i < len; i++) {
            const item = kdItems[i];
            const sceneObject = item.sceneObject;
            const meshHits = [];
            for (let j = 0, lenj = sceneObject.meshes.length; j < lenj; j++) {
                const mesh = sceneObject.meshes[j];
                const geometryBucketHits = [];
                //////////////////////
                // Transform ray into mesh local space, by inverse of mesh matrix
                ///////////////////////
                const geometry = mesh.geometry;
                for (let k = 0, lenk = geometry.geometryBuckets.length; k < lenk; k++) {
                    const primitiveHits = [];
                    const geometryBucket = geometry.geometryBuckets[k];
                    let primsKdTree3D = this.#getPrimsKdTree3D(geometry, k, geometryBucket);
                    const primitives = searchKdTree3DWithRay({kdTree: primsKdTree3D.primsKdTree3D, origin, dir});
                    if (primitives.length) {
                        switch (geometry.primitive) {
                            case TrianglesPrimitive:
                                for (let l = 0, lenl = primitives.length; l < lenl; l++) {
                                    const triangle = <KdTrianglePrim>primitives[l];
                                    const a = triangle.a;
                                    const b = triangle.b;
                                    const c = triangle.c;
                                    const cx = primsKdTree3D.positions[a * 3];
                                    const cy = primsKdTree3D.positions[a * 3 + 1];
                                    const cz = primsKdTree3D.positions[a * 3 + 2];

                                    //////////////////////////
                                    // Get ray-triangle intersection in worldPos
                                    /////////////////////////////

                                    //     primitiveHits.push({primitive: triangle, worldPos});
                                }
                                break;
                            case LinesPrimitive:
                                for (let l = 0, lenl = primitives.length; l < lenl; l++) {
                                    const line = <KdLinePrim>primitives[l];
                                    //     primitiveHits.push({primitive: line, worldPos});
                                }
                                break;
                            case PointsPrimitive:
                                for (let l = 0, lenl = primitives.length; l < lenl; l++) {
                                    const point = <KdPointPrim>primitives[l];
                                    //      primitiveHits.push({primitive: point, worldPos});
                                }
                                break;
                        }
                    }
                    if (primitiveHits.length > 0) {
                        geometryBucketHits.push({geometryBucket, primitiveHits});
                    }
                }
                if (geometryBucketHits.length > 0) {
                    meshHits.push({mesh, geometry, geometryBucketHits})
                }
            }
            if (meshHits.length) {
                rayPickResult.sceneObjectHits.push({sceneObject, meshHits});
            }
        }
        return rayPickResult;
    }

    /**
     * Picks a {@link SceneObjectsKdTree3D} using a 2D marquee to obtain a {@link MarqueePickResult}
     * containing picked {@link SceneObject | SceneObjects}, {@link Mesh}, {@link Geometry},
     * {@link GeometryBucket | GeometryBuckets}, {@link KdTrianglePrim}, {@link KdLinePrim} and {@link KdPointPrim}.
     * @param params
     */
    marqueePick(params: {
        sceneObjectsKdTree3D: SceneObjectsKdTree3D,
        marquee: FloatArrayParam
    }): MarqueePickResult {
        const sceneObjectsKdTree3D = params.sceneObjectsKdTree3D;
        const pickPrimsCache = this.#pickPrimsCache;
        const marqueePickResult = <MarqueePickResult>{
            sceneObjects: []
        };
        const frustum = null; // Create from marquee
        const kdItems = searchKdTree3DWithFrustum({
            kdTree: sceneObjectsKdTree3D,
            frustum
        });
        for (let i = 0, len = kdItems.length; i < len; i++) {
            const kdItem = kdItems[i];
            const sceneObject = kdItem.item;
            const meshes = [];
            for (let j = 0, lenj = sceneObject.meshes.length; j < lenj; j++) {
                const mesh = sceneObject.meshes[j];
                const pickedGeometryMeshes = [];
                //////////////////////
                // Transform frustum into mesh local space, by inverse of mesh matrix
                ///////////////////////
                const geometry = mesh.geometry;
                for (let k = 0, lenk = geometry.geometryBuckets.length; k < lenk; k++) {
                    const prims = [];
                    const geometryBucket = geometry.geometryBuckets[k];
                    let primsKdTree3D = this.#getPrimsKdTree3D(geometry, k, geometryBucket);
                    const items = searchKdTree3DWithFrustum({
                        kdTree: primsKdTree3D.primitivesKdTree,
                        frustum
                    });
                    if (items.length) {
                        switch (geometry.primitive) {
                            case TrianglesPrimitive:
                                for (let l = 0, lenl = items.length; l < lenl; l++) {
                                    const item = items[l];
                                    const triangle = <KdTrianglePrim>item.item.prim;
                                    const a = triangle.a;
                                    const b = triangle.b;
                                    const c = triangle.c;
                                    const cx = primsKdTree3D.positions[a * 3];
                                    const cy = primsKdTree3D.positions[a * 3 + 1];
                                    const cz = primsKdTree3D.positions[a * 3 + 2];
                                    //////////////////////////
                                    // Get FRUSTUM-TRIANGLE-CENTER intersection in worldPos
                                    /////////////////////////////
                                    // prims.push({primitive: triangle, worldPos});
                                }
                                break;
                            case LinesPrimitive:
                                for (let l = 0, lenl = items.length; l < lenl; l++) {
                                    const item = items[l];
                                    const line = <KdLinePrim>item.item.prim;
                                    // prims.push({primitive: line, worldPos});
                                }
                                break;
                            case PointsPrimitive:
                                for (let l = 0, lenl = items.length; l < lenl; l++) {
                                    const item = items[l];
                                    const point = <KdPointPrim>item.item.prim;

                                    //      prims.push({primitive: point, worldPos});
                                }
                                break;
                        }
                    }
                }
            }
            /////////////////////////////////////////////////////////////////////////
            const selected = false;

            if (selected) {
                marqueePickResult.sceneObjects.push(sceneObject);
            }
        }
        return marqueePickResult;
    }

    #getPrimsKdTree3D(geometry: Geometry, k: number, geometryBucket: GeometryBucket) {
        const kdTreeId = `${geometry.id}-${k}`;
        let primsKdTree3D = this.#pickPrimsCache[kdTreeId];
        if (!primsKdTree3D) {
            const positions = decompressPositions3(
                geometryBucket.positionsCompressed,
                geometry.positionsDecompressMatrix,
                new Float32Array(geometryBucket.positionsCompressed.length));
            primsKdTree3D = {
                primsKdTree3D: createPrimsKdTree3D(geometry.primitive, positions, geometryBucket.indices),
                positions
            }
            this.#pickPrimsCache[kdTreeId] = primsKdTree3D;
        }
        return primsKdTree3D;
    }
}