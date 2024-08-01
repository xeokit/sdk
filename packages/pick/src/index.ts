/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * # xeokit Picking System
 *
 * ---
 *
 * ### *Select objects and primitives using rays and boundaries*
 *
 * ---
 *
 * The following class diagrams depict xeokit's picking system architecture.
 *
 * The {@link @xeokit/collision!SceneObjectsKdTree3 | SceneObjectsKdTree3} class, a k-d tree that arranges
 * {@link @xeokit/scene!SceneObject | SceneObjects} for
 * efficient collision testing with boundaries, rays, and frustums, is positioned in the center of the
 * first diagram. To construct a SceneObjectsKdTree3, use
 * the {@link @xeokit/collision!createSceneObjectsKdTree3 | createSceneObjectsKdTree3} function.
 *
 * To find SceneObjects in the SceneObjectsKdTree3 that intersect a 3D world-space ray,
 * use {@link Picker.rayPick | Picker.rayPick()}, which will generate a {@link RayPickResult}. To find SceneObjects
 * that intersect a 2D marquee boundary, use {@link Picker.marqueePick | Picker.marqueePick()},
 * which will generate a {@link MarqueePickResult}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNp9k99PgzAQx_-V5p6cQTLkdx98MlGji2bzyfSlwqnVUbRAskn4322BuYFMEtLLfe_z5Xq0NSR5ikAhWfOiuBT8VfGMyVQoTEqRS3K3ZJJJQsxrnraOrBKUeP_8rovqndL0gV66yIBd1EEPIvlARX4BQhTfmuTJbfqoEF2L5Eq8Ckn052d02YlLLKp1WeyhjKuvCnEI9skZXezVAdmMuznYQtHbaK3eFTXD6r-2prQ48Bhhe3S4jxF2Lf6Q_ZgYOAxOz84udGDbpwwmeqDkSjspXmLR_SMmj9KjNgboIZS3kCGmJkTJCrlK3gw1pbfkpAUlNzLFjQEnhvkft8J1N-DRFo4z5BcCCzJUGRepPuPtyWNQvmGGDKgOU3zh2osBk40u5VWZr7YyAVqqCi2oPlM9oP5WAH3h60JnMRVlrhb9vTGLBZ9cAq1hA9QJYzsI5lHoeL7jeLEbWbAF6gaR7cZz3_HOg_g89KLGgu88165z2w_8UGuuH8wDN_Lc1u6pFU0fzQ91PCxm?type=png)](https://mermaid.live/edit#pako:eNp9k99PgzAQx_-V5p6cQTLkdx98MlGji2bzyfSlwqnVUbRAskn4322BuYFMEtLLfe_z5Xq0NSR5ikAhWfOiuBT8VfGMyVQoTEqRS3K3ZJJJQsxrnraOrBKUeP_8rovqndL0gV66yIBd1EEPIvlARX4BQhTfmuTJbfqoEF2L5Eq8Ckn052d02YlLLKp1WeyhjKuvCnEI9skZXezVAdmMuznYQtHbaK3eFTXD6r-2prQ48Bhhe3S4jxF2Lf6Q_ZgYOAxOz84udGDbpwwmeqDkSjspXmLR_SMmj9KjNgboIZS3kCGmJkTJCrlK3gw1pbfkpAUlNzLFjQEnhvkft8J1N-DRFo4z5BcCCzJUGRepPuPtyWNQvmGGDKgOU3zh2osBk40u5VWZr7YyAVqqCi2oPlM9oP5WAH3h60JnMRVlrhb9vTGLBZ9cAq1hA9QJYzsI5lHoeL7jeLEbWbAF6gaR7cZz3_HOg_g89KLGgu88165z2w_8UGuuH8wDN_Lc1u6pFU0fzQ91PCxm)
 *
 * <br>
 *
 * ### Unpacking the Pick Results
 *
 * A {@link MarqueePickResult} provides a list of SceneObjects that intersect the marquee, so unpacking that is trivial.
 *
 * On the other hand, a {@link RayPickResult} includes comprehensive details regarding
 * each ray-SceneObject intersection. This information includes everything necessary to inspect the geometry of the intersecting
 * primitives within each SceneObject, and the coordinates at which each of them intersect the ray.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqlVVtvmzAY_SvIj1USBXKh8LCHtlI3bdGiptKkiRcHvqZewY5ssyWr8t9nDA42kLbSePHtnOPvil9RyjJAMUpzLMQdwTuOi4RmhEMqCaPe401CE-rpT2O8TQoUvm9_KcCrOam-AsQzCHsH4-3WrE-uyEqBPYu-A1aA5Md2p8CSk0OH7orcNyRbaM9JQST5DdYWE6TyRdxByoo9ByFWjnh7_U2ZvoAUF4y-d1DOreaK2-YCyNpDosKZQk-0GYakPxM5FJz60PVVQY3yqc2UlSMvQX6CrsZjNU4mVwnSsY-9W0YlJvRs1jmYPbxrW5-pc2mxLIoNbq0zTj_g45qkLw8gylw7LFqzW7-0WzXha_aNUJiZ2OCYlsUWeL3anlenFv_ICaa7_H2OtmpIYc0IlQN0y6yNY7aBWs7UG1WD1G5Z3FW9aUgVpp65HbHr1oersq4rwahUhVHP_jCeKxcM2o24SliC2Hj8SU86biS049ZldOxtIFejTvLbrMbdhBq_B84tuWFUr1kuyrV1eJbsd9oFjin3jzObLNSlblLSwVglGf_geC_eQOpifxdVF2jsNTj7B9z9TP9o6nA04y80g4P7H-_LNE3x3zpte35ACo1QAbzAJFPvla70BMlnKCBBsZpm8IRVVSdI1bqC4lKyzZGmKH7CuYARKvcZltA8ceddyIhkfNU8gtUwQntMUfyKDij2l9OJH_lBGAbBchrM_MUIHVG8nE2i63AWTueLKArCaL44jdBfxpTsdHIdLOfzZTBb-GEUTf1A6_3Uh5KXcPoHqcxSqw?type=png)](https://mermaid.live/edit#pako:eNqlVVtvmzAY_SvIj1USBXKh8LCHtlI3bdGiptKkiRcHvqZewY5ssyWr8t9nDA42kLbSePHtnOPvil9RyjJAMUpzLMQdwTuOi4RmhEMqCaPe401CE-rpT2O8TQoUvm9_KcCrOam-AsQzCHsH4-3WrE-uyEqBPYu-A1aA5Md2p8CSk0OH7orcNyRbaM9JQST5DdYWE6TyRdxByoo9ByFWjnh7_U2ZvoAUF4y-d1DOreaK2-YCyNpDosKZQk-0GYakPxM5FJz60PVVQY3yqc2UlSMvQX6CrsZjNU4mVwnSsY-9W0YlJvRs1jmYPbxrW5-pc2mxLIoNbq0zTj_g45qkLw8gylw7LFqzW7-0WzXha_aNUJiZ2OCYlsUWeL3anlenFv_ICaa7_H2OtmpIYc0IlQN0y6yNY7aBWs7UG1WD1G5Z3FW9aUgVpp65HbHr1oersq4rwahUhVHP_jCeKxcM2o24SliC2Hj8SU86biS049ZldOxtIFejTvLbrMbdhBq_B84tuWFUr1kuyrV1eJbsd9oFjin3jzObLNSlblLSwVglGf_geC_eQOpifxdVF2jsNTj7B9z9TP9o6nA04y80g4P7H-_LNE3x3zpte35ACo1QAbzAJFPvla70BMlnKCBBsZpm8IRVVSdI1bqC4lKyzZGmKH7CuYARKvcZltA8ceddyIhkfNU8gtUwQntMUfyKDij2l9OJH_lBGAbBchrM_MUIHVG8nE2i63AWTueLKArCaL44jdBfxpTsdHIdLOfzZTBb-GEUTf1A6_3Uh5KXcPoHqcxSqw)
 *
 * <br>
 *
 * RayPickResult represents the hierarchical arrangement of Scene components selected by Picker.rayPick(). This
 * structure enables the iteration of the chosen SceneObjects, and the iteration of the selected Meshes, Geometries, and
 * GeometryBuckets within each SceneObject. The structure goes all the way down to the chosen primitives, which can be
 * KdLine3D, KdPoint3D, or KdTriangle3D.
 *
 * A primitive has one or more vertex indices, and the number of indices is determined by the primitive type. These
 * indices are used to access the compressed vertex coordinates of the primitive within
 * SceneGeometryBucket.positionsCompressed. These coordinates can be decompressed using SceneGeometry.positionsDecompressMatrix and
 * then transformed into the World-space coordinate system using SceneMesh.matrix to obtain the final coordinates of the primitive.
 *
 * To keep a low memory footprint, while being flexible and extensible, both the RayPickResult and xeokit's
 * scene graph have been designed in such a way that requires some boilerplate code to traverse and unpack them. This
 * includes coordinate decompression and transformation, which we'll demonstrate in the example code below.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/collision
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SDKError} from "@xeokit/core";
 * import {TrianglesPrimitive, LinesPrimitive, PointsPrimitive} from "@xeokit/constants";
 * import {KdTree3, searchKdTree3WithAABB} from "@xeokit/kdtree3";
 *
 * // Create a scene graph - notice there's not a Viewer in sight
 *
 * const scene = new Scene();
 *
 * const sceneModel = scene.createModel({
 *      id: "myModel"
 * });
 *
 * if (sceneModel instanceof SDKError) {
 *      console.log(sceneModel.message);
 *
 * } else {
 *
 *     // Build our standard Table model, with a table top and four legs
 *
 *     sceneModel.createGeometry({
 *         id: "theGeometry", primitive: TrianglesPrimitive,
 *         positions: [10.07, 0, 11.07, 9.58, 3.11, 11.07, 8.15, ..],
 *         indices: [21, 0, 1, 1, 22, 21, 22, 1, 2, 2, 23, 22, 23, ..]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "redLegMesh", geometryId: "theGeometry",
 *         position: [-4, -6, -4], scale: [1, 3, 1], rotation: [0, 0, 0], color: [1, 0.3, 0.3]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "greenLegMesh", geometryId: "theGeometry", position: [4, -6, -4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 1.0, 0.3]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "blueLegMesh", geometryId: "theGeometry", position: [4, -6, 4],  scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "yellowLegMesh",  geometryId: "theGeometry", position: [-4, -6, 4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [1.0, 1.0, 0.0]
 *     });
 *
 *     sceneModel.createLayerMesh({
 *         id: "tableTopMesh", geometryId: "theGeometry", position: [0, -3, 0], scale: [6, 0.5, 6],
 *         rotation: [0, 0, 0], color: [1.0, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createObject({ id: "redLegSceneObject", meshIds: ["redLegMesh"] });
 *     sceneModel.createObject({ id: "greenLegSceneObject", meshIds: ["greenLegMesh"] });
 *     sceneModel.createObject({ id: "blueLegSceneObject", meshIds: ["blueLegMesh"] });
 *     sceneModel.createObject({ id: "yellowLegSceneObject", meshIds: ["yellowLegMesh"] });
 *     sceneModel.createObject({ id: "tableTopSceneObject", meshIds: ["tableTopMesh"] });
 *
 *     sceneModel.build()
 *
 *         .then(() => {
 *
 *             // When our model is finalized, insert all
 *             // its SceneObjects into a SceneObjectsKdTree3
 *
 *             const sceneObjectsKdTree3 = createSceneObjectsKdTree3(Object.values(scene.objects));
 *
 *             // Then we'll try to ray-pick the SceneObjects
 *
 *             const picker = new Picker();
 *
 *             const rayPickResult = picker.rayPick({
 *                 sceneObjectsKdTree3,
 *                 origin: [0,0,100],
 *                 dir: [0,0,-1];
 *             });
 *
 *             // We get a RayPickResults, which contains a
 *             // SceneObjectHit that wraps each SceneObject we picked
 *
 *             for (let i =0, len = rayPickResult.sceneObjectHits.length; i < len; i++) {
 *
 *                 const sceneObjectHit = rayPickResult.sceneObjectHits[i];
 *                 const sceneObject = sceneObjectHit.sceneObject;
 *
 *                 // Within each SceneObjectHit we get a MeshHit that wraps each SceneMesh that
 *                 // was picked in this SceneObject
 *
 *                 const meshHit = sceneObjectHit.meshHit;
 *                 const mesh = meshHit.mesh;
 *
 *                 // Within the MeshHit, a single GeometryHit that wraps
 *                 // the SceneGeometry that was picked
 *
 *                 const geometryHit = meshHit.geometryHit;
 *                 const geometry = geometryHit.geometry;
 *
 *                 // Within the GeometryHit, we get a GeometryBucketHit for each hit
 *
 *                 const geometryBucketHit = geometryHit.geometryBucketHit;
 *                 const geometryBucket = geometryBucketHit.geometryBucket;
 *
 *                 // And finally within the GeometryBucketHit, a PrimHit
 *                 // for each primitive that was hit within the SceneGeometryBucket.
 *
 *                 // Each PrimtHit wraps a single a single KdPointPrim, KdLinePrim or KdTrianglePrim,
 *                 // which represents a point, line or triangle primitive, respectively.
 *
 *                 for (let j = 0, lenj = geometryBucketHit.primHits.length; j < lenj; j++) {
 *
 *                     const primHit = geometryBucketHit.primHits[j];
 *                     const primitive = primHit.primitive;
 *
 *                     // We know the primitive type from the SceneGeometry
 *
 *                     switch (geometry.primitive) {
 *
 *                         case TrianglesPrimitive:
 *
 *                             // Using the vertex indices of each primitive,
 *                             // we can then access the compressed coordinates
 *                             // for that vertex, then we can decompress them
 *                             // and transform them into World-space.
 *
 *                              const kdTriangle3D = primHit.prim;
 *
 *                              break;
 *
 *                         case LinesPrimitive:
 *                              const kdTriangle3D = primHit.prim;
 *
 *                              break;
 *
 *                         case PointsPrimitive:
 *                              const kdPoint3D = primHit.prim;
 *
 *                              break;
 *                      }
 *                  }
 *              }
 *          });
 * }
 *
 * ````
 *
 * @module @xeokit/pick
 */
export * from "./Picker";
export * from "./MarqueePickResult";
export * from "./RayPickResult";
export {SceneObjectHit} from "./SceneObjectHit";
export {MeshHit} from "./MeshHit";
export {GeometryHit} from "./GeometryHit";
export {PrimHit} from "./PrimHit";


