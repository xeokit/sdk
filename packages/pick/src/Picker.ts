import {
    createPrimsKdTree3,
    KdLinePrim,
    KdPointPrim,
    KdTrianglePrim,
    SceneObjectsKdTree3,
    searchKdTree3WithFrustum,
    searchKdTree3WithRay
} from "@xeokit/kdtree3";
import type {FloatArrayParam} from "@xeokit/math";
import type {RayPickResult} from "./RayPickResult";
import type {MarqueePickResult} from "./MarqueePickResult";
import {PickPrimsCache} from "./PickPrimsCache";
import {decompressPositions3WithAABB3} from "@xeokit/compression";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/constants";
import type {SceneGeometry, SceneObject} from "@xeokit/scene";

import type {Frustum3} from "@xeokit/boundaries";

/**
 * See {@link "@xeokit/collision!pick"} for usage.
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
        sceneObjectsKdTree3: SceneObjectsKdTree3,
        origin: FloatArrayParam,
        dir: FloatArrayParam
    }): RayPickResult {

        //
        // Cache for different Scene's?
        //

        const sceneObjectsKdTree3 = params.sceneObjectsKdTree3;
        const origin = params.origin;
        const dir = params.dir;
        const rayPickResult = <RayPickResult>{
            sceneObjectHits: []
        };
        // const kdItems = searchKdTree3WithRay({kdTree: sceneObjectsKdTree3, origin, dir});
        // for (let i = 0, len = kdItems.length; i < len; i++) {
        //     const item = kdItems[i];
        //     const sceneObject: SceneObject = item.sceneObject;
        //     const meshHits: MeshHit[] = [];
        //     for (let j = 0, lenj = sceneObject.meshes.length; j < lenj; j++) {
        //         const mesh = sceneObject.meshes[j];
        //         const geometryBucketHits: GeometryBucketHit[] = [];
        //         //////////////////////
        //         // Transform ray into mesh local space, by inverse of mesh matrix
        //         ///////////////////////
        //         const geometry = mesh.geometry;
        //         for (let k = 0, lenk = geometry.geometryBuckets.length; k < lenk; k++) {
        //             const primHits: any[] = [];
        //             const geometryBucket = geometry.geometryBuckets[k];
        //             let primsKdTree3 = this.#getPrimsKdTree3(geometry, k, geometryBucket);
        //             const primitives = searchKdTree3WithRay({kdTree: primsKdTree3.primsKdTree3, origin, dir});
        //             if (primitives.length) {
        //                 switch (geometry.primitive) {
        //                     case TrianglesPrimitive:
        //                         for (let l = 0, lenl = primitives.length; l < lenl; l++) {
        //                             // const triangle = <KdTrianglePrim>primitives[l];
        //                             // const a = triangle.a;
        //                             // const b = triangle.b;
        //                             // const c = triangle.c;
        //                             // const cx = primsKdTree3.positions[a * 3];
        //                             // const cy = primsKdTree3.positions[a * 3 + 1];
        //                             // const cz = primsKdTree3.positions[a * 3 + 2];
        //
        //                             //////////////////////////
        //                             // Get ray-triangle intersection in worldPos
        //                             /////////////////////////////
        //
        //                             //     primHits.push({primitive: triangle, worldPos});
        //                         }
        //                         break;
        //                     case LinesPrimitive:
        //                         for (let l = 0, lenl = primitives.length; l < lenl; l++) {
        //                           //  const line = <KdLinePrim>primitives[l];
        //                             //     primHits.push({primitive: line, worldPos});
        //                         }
        //                         break;
        //                     case PointsPrimitive:
        //                         for (let l = 0, lenl = primitives.length; l < lenl; l++) {
        //                         //    const point = <KdPointPrim>primitives[l];
        //                             //      primHits.push({primitive: point, worldPos});
        //                         }
        //                         break;
        //                 }
        //             }
        //             if (primHits.length > 0) {
        //                 geometryBucketHits.push({geometryBucket, primHits});
        //             }
        //         }
        //         if (geometryBucketHits.length > 0) {
        //             meshHits.push({mesh, geometry, geometryBucketHits})
        //         }
        //     }
        //     if (meshHits.length) {
        //         rayPickResult.sceneObjectHits.push({sceneObject, meshHits});
        //     }
        // }
        return rayPickResult;
    }

    /**
     * Picks a {@link @xeokit/scene!SceneObjectsKdTree3} using a 2D marquee to obtain a {@link MarqueePickResult}
     * containing picked {@link @xeokit/scene!SceneObject | SceneObjects}, {@link @xeokit/scene!SceneMesh}, {@link @xeokit/scene!SceneGeometry},
     * {@link @xeokit/scene!SceneGeometryBucket | GeometryBuckets}, {@link KdTrianglePrim}, {@link KdLinePrim} and {@link KdPointPrim}.
     * @param params
     */
    marqueePick(params: {
        sceneObjectsKdTree3: SceneObjectsKdTree3,
        marquee: FloatArrayParam
    }): MarqueePickResult {
        const sceneObjectsKdTree3 = params.sceneObjectsKdTree3;
        const pickPrimsCache = this.#pickPrimsCache;
        const marqueePickResult = <MarqueePickResult>{
            sceneObjects: []
        };
        // @ts-ignore
        const frustum: Frustum3 = null; // Create from marquee
        const kdItems = searchKdTree3WithFrustum({
            kdTree: sceneObjectsKdTree3,
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
                    let primsKdTree3 = this.#getPrimsKdTree3(geometry, k);
                    const items = searchKdTree3WithFrustum({
                        kdTree: primsKdTree3.primitivesKdTree,
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
                                    const cx = primsKdTree3.positions[a * 3];
                                    const cy = primsKdTree3.positions[a * 3 + 1];
                                    const cz = primsKdTree3.positions[a * 3 + 2];
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

    #getPrimsKdTree3(geometry: SceneGeometry, k: number): any {
        const kdTreeId = `${geometry.id}-${k}`;
        // @ts-ignore
        let primsKdTree3 = this.#pickPrimsCache[kdTreeId];
        if (!primsKdTree3) {
            const positions = decompressPositions3WithAABB3(
                geometry.positionsCompressed,
                geometry.aabb,
                new Float32Array(geometry.positionsCompressed.length));
            primsKdTree3 = {
                primsKdTree3: createPrimsKdTree3(geometry.primitive, positions, geometry.indices),
                positions
            }
            // @ts-ignore
            this.#pickPrimsCache[kdTreeId] = primsKdTree3;
        }
        return primsKdTree3;
    }
}
