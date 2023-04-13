import {FloatArrayParam} from "@xeokit/math/math";
import {decompressPositions} from "@xeokit/math/compression";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";

import {
    createKdTree3DFromArrayPrims,
    KdLinePrim,
    KdPointPrim,
    KdTree3D,
    KdTrianglePrim,
    searchKdTree3DWithRay
} from "../kdtree3d";
import {RayPickResult} from "./RayPickResult";


/**
 *
 * @param params
 */
export function rayPick(params: {
    kdTree3DWithSceneObjects: KdTree3D,
    primitivesKdTrees: {
        [key: string]: {
            primitivesKdTree: KdTree3D,
            positions: FloatArrayParam
        }
    };
    origin: FloatArrayParam,
    dir: FloatArrayParam
}): RayPickResult {
    const kdTree3DWithSceneObjects = params.kdTree3DWithSceneObjects;
    const primitivesKdTrees = params.primitivesKdTrees;
    const origin = params.origin;
    const dir = params.dir;
    const rayPickResult = <RayPickResult>{
        sceneObjects: []
    };
    const kdItems = searchKdTree3DWithRay({kdTree: kdTree3DWithSceneObjects, origin, dir});
    for (let i = 0, len = kdItems.length; i < len; i++) {
        const item = kdItems[i];
        const sceneObject = item.sceneObject;
        const meshResults = [];
        for (let j = 0, lenj = sceneObject.meshes.length; j < lenj; j++) {
            const mesh = sceneObject.meshes[j];
            const geometryBucketsResults = [];
            //////////////////////
            // Transform ray into mesh local space, by inverse of mesh matrix
            ///////////////////////
            const geometry = mesh.geometry;
            for (let k = 0, lenk = geometry.geometryBuckets.length; k < lenk; k++) {
                const primitiveHits = [];
                const geometryBucket = geometry.geometryBuckets[k];
                const kdTreeId = `${geometry.id}-${k}`;
                let primitivesKdTree = primitivesKdTrees[kdTreeId];
                if (!primitivesKdTree) {
                    const positions = decompressPositions(
                        geometryBucket.positionsCompressed,
                        geometry.positionsDecompressMatrix,
                        new Float32Array(geometryBucket.positionsCompressed.length));
                    primitivesKdTree = {
                        primitivesKdTree: createKdTree3DFromArrayPrims(geometry.primitive, positions, geometryBucket.indices),
                        positions
                    }
                    primitivesKdTrees[kdTreeId] = primitivesKdTree;
                }
                const primitives = searchKdTree3DWithRay({kdTree: primitivesKdTree.primitivesKdTree, origin, dir});
                if (primitives.length) {
                    switch (geometry.primitive) {
                        case TrianglesPrimitive:
                            for (let l = 0, lenl = primitives.length; l < lenl; l++) {
                                const triangle = <KdTrianglePrim>primitives[l];
                                const a = triangle.a;
                                const b = triangle.b;
                                const c = triangle.c;
                                const cx = primitivesKdTree.positions[a * 3];
                                const cy = primitivesKdTree.positions[a * 3 + 1];
                                const cz = primitivesKdTree.positions[a * 3 + 2];

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
                    geometryBucketsResults.push({geometryBucket, primitiveHits});
                }
            }
            if (geometryBucketsResults.length > 0) {
                meshResults.push({mesh, geometryBuckets: geometryBucketsResults})
            }
        }
        if (meshResults.length) {
            rayPickResult.sceneObjects.push({sceneObject, meshes: meshResults});
        }
    }
    return rayPickResult;
}