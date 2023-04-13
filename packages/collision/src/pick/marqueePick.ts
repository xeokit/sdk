import {FloatArrayParam} from "@xeokit/math/math";
import {decompressPositions} from "@xeokit/math/compression";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";

import {
    createKdTree3DFromArrayPrims,
    KdLinePrim,
    KdPointPrim,
    KdTree3D,
    KdTrianglePrim,
    searchKdTree3DWithFrustum
} from "../kdtree3d";
import {PickPrimsCache} from "./PickPrimsCache";
import {MarqueePickResult} from "./MarqueePickResult";

/**
 *
 * @param params
 */
export function marqueePick(params: {
    kdTree3DWithSceneObjects: KdTree3D,
    pickPrimsCache: PickPrimsCache,
    marquee: FloatArrayParam
}): MarqueePickResult {
    const kdTree3DWithSceneObjects = params.kdTree3DWithSceneObjects;
    const pickPrimsCache = params.pickPrimsCache;
    const marqueePickResult = <MarqueePickResult>{
        sceneObjects: []
    };
    const frustum = null; // Create from marquee
    const kdItems = searchKdTree3DWithFrustum({
        kdTree: kdTree3DWithSceneObjects,
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
                const kdTreeId = `${geometry.id}-${k}`;
                let primitivesKdTree = pickPrimsCache.primitivesKdTrees[kdTreeId];
                if (!primitivesKdTree) {
                    const positions = decompressPositions(
                        geometryBucket.positionsCompressed,
                        geometry.positionsDecompressMatrix,
                        new Float32Array(geometryBucket.positionsCompressed.length));
                    primitivesKdTree = {
                        primitivesKdTree: createKdTree3DFromArrayPrims(geometry.primitive, positions, geometryBucket.indices),
                        positions
                    }
                    pickPrimsCache.primitivesKdTrees[kdTreeId] = primitivesKdTree;
                }
                const items = searchKdTree3DWithFrustum({
                    kdTree: primitivesKdTree.primitivesKdTree,
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
                                const cx = primitivesKdTree.positions[a * 3];
                                const cy = primitivesKdTree.positions[a * 3 + 1];
                                const cz = primitivesKdTree.positions[a * 3 + 2];
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
                if (prims.length > 0) {
                    pickedGeometryMeshes.push({
                        geometryBucket, 
                        prims
                    });
                }
            }
            if (pickedGeometryMeshes.length > 0) {
                meshes.push({
                    mesh,
                    pickedGeometryMeshes
                })
            }
        }
        if (meshes.length) {
            marqueePickResult.sceneObjects.push({
                sceneObject,
                meshes
            });
        }
    }
    return marqueePickResult;
}