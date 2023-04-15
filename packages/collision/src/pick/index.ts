/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height:160px;" src="media://images/kdtree3d.png"/>
 *
 * # xeokit Picking System
 *
 * ---
 *
 * ### *Select objects and primitives with rays and intersection boundaries*
 *
 * ---
 *
 * The following class diagrams depict xeokit's picking system architecture.
 *
 * ### SceneObjects in a k-d Tree
 *
 * The {@link @xeokit/collision/kdtree3d!SceneObjectsKdTree3D | SceneObjectsKdTree3D} class, a k-d tree that arranges
 * {@link @xeokit/scene!SceneObject | SceneObjects} for
 * efficient collision testing with boundaries, rays, and frustums, is positioned in the center of the
 * first diagram. To construct a SceneObjectsKdTree3D, use
 * the {@link @xeokit/collision/kdtree3d!createSceneObjectsKdTree3D | createSceneObjectsKdTree3D} function.
 *
 * ### Ray and Marquee Picking
 *
 * To find SceneObjects in the SceneObjectsKdTree3D that intersect a 3D world-space ray,
 * use {@link Picker.rayPick | Picker.rayPick()}, which will generate a {@link RayPickResult}. To find SceneObjects
 * that intersect a 2D marquee boundary, use {@link Picker.marqueePick | Picker.marqueePick()},
 * which will generate a {@link MarqueePickResult}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNp9k99vgjAQx_-V5p6mQSLyQ-zDnky2ZTNbdE9LXzo4tZsUVyDRGf73tYBTGY6E9HL3_Xy5Hu0BojRGoBBteJZNBV8pnjAZC4VRLlJJnuZMMkmIec1T6cgiQonP7x9adDhWyibQSx0ZsI5q6EVEn6jIL0CI4nuTvHmMXxWiO7VIqsRKSKK_36PzujrHrNjk2YlKuPoqEFtkk-3R2al8gZbtfs42kR19dPFwVJWX8r--RpqdmbSwE3q5kxZ2L_6QzaQYOAz6g8GtDmy7z6CjB0rutJPiOWb1b2LyKt1q4wI9h9IKMkTniChZIFfR2mCdgortNKHkQca4M2THOP_jFripR9zaxHWG_EJgQYIq4SLWB706fgzyNSbIgOowxiXXXgyYLLWUF3m62MsIaK4KtKDYxnpEzdUAuuSbTGcxFnmqZs3lMYsFWy6BHmAH1BlP7CAYhmPH8x3Hm7ihBXugbhDa7mToO94omIzGXlha8J2m2nVo-4E_1jXXD4aBG3puZfdWFU0f5Q-6AC26?type=png)](https://mermaid.live/edit#pako:eNp9k99vgjAQx_-V5p6mQSLyQ-zDnky2ZTNbdE9LXzo4tZsUVyDRGf73tYBTGY6E9HL3_Xy5Hu0BojRGoBBteJZNBV8pnjAZC4VRLlJJnuZMMkmIec1T6cgiQonP7x9adDhWyibQSx0ZsI5q6EVEn6jIL0CI4nuTvHmMXxWiO7VIqsRKSKK_36PzujrHrNjk2YlKuPoqEFtkk-3R2al8gZbtfs42kR19dPFwVJWX8r--RpqdmbSwE3q5kxZ2L_6QzaQYOAz6g8GtDmy7z6CjB0rutJPiOWb1b2LyKt1q4wI9h9IKMkTniChZIFfR2mCdgortNKHkQca4M2THOP_jFripR9zaxHWG_EJgQYIq4SLWB706fgzyNSbIgOowxiXXXgyYLLWUF3m62MsIaK4KtKDYxnpEzdUAuuSbTGcxFnmqZs3lMYsFWy6BHmAH1BlP7CAYhmPH8x3Hm7ihBXugbhDa7mToO94omIzGXlha8J2m2nVo-4E_1jXXD4aBG3puZfdWFU0f5Q-6AC26)
 *
 * <br>
 *
 * ### Unpacking the Pick Results
 *
 * A {@link MarqueePickResult} provices a list of SceneObjects that intersect the marquee, so unpacking that is trivial.
 *
 * On the other hand, a {@link RayPickResult} includes comprehensive details regarding
 * each ray-SceneObject intersection. This information includes everything necessary to inspect the geometry of the intersecting
 * primitives within each SceneObject, and the coordinates at which each of them intersect the ray.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqlVVtvmzAY_SvIj1USBXKh8LCHNVI3rdGiZNKkiRcHvqZewY5ssyWL8t9nDAZzSVdpvPh2zvF3xRcUswRQiOIUC7Ei-MBxFtGEcIglYdR52kY0oo7-NMbZxUDh6_6nAlzMSfFlIF5A2DsY7_dmfW2LrBXYsegHYBlIfm52Miw5OXXobZHHimQLHTnJiCS_wNpighS-iBXELDtyEGLdEm-u_5jHryDFDaMfW6jWreaKh-oCSJpDosIZQ0-0GoakPxE5FJzysO2rghrla5MpK0dOhNwI3Y3HapxM7iKkYx86D4xKTGhtVh3MHr5tW5-pc2mxLIoNbqwzTm_xeUPi1y2IPNUOi8bsxi_tVkn4kjwRCrOVCQ4OaZ7tgZerfb26NoRvnGB6SN9B0nYNSWwYoXKIb1m2a1luoJY_5UbRI6VnFnddbhpSgSln7aY4dEukrbIpi8GoFLVRzn4zniofDLoddJWzCLHx-IOedNyIaMet2-jQ2UGqRp3nt1mVuxE1fg-cW3LDqF6_3JRrSrGW7DfbDY6p-PczqyyU1W5S0sHYRRl-5_go3oCWBf9PWFWjoVMB7d9w96u7SJOHIxp-pgmc2r_zvo7pjP8Wsrr0HVpohDLgGSaJerh0vUdIvkAGEQrVNIFnrGo7QqriFRTnku3ONEbhM04FjFB-TLCE6q2rdyEhkvF19RoWwwgdMUXhBZ1Q6C6nEzdwPd_3vOXUm7mLETqjcDmbBPf-zJ_OF0Hg-cF8cR2hP4wp2enk3lvO50tvtnD9IJi6rtb7oQ8lz-H6FwSyVRY?type=png)](https://mermaid.live/edit#pako:eNqlVVtvmzAY_SvIj1USBXKh8LCHNVI3rdGiZNKkiRcHvqZewY5ssyWL8t9nDAZzSVdpvPh2zvF3xRcUswRQiOIUC7Ei-MBxFtGEcIglYdR52kY0oo7-NMbZxUDh6_6nAlzMSfFlIF5A2DsY7_dmfW2LrBXYsegHYBlIfm52Miw5OXXobZHHimQLHTnJiCS_wNpighS-iBXELDtyEGLdEm-u_5jHryDFDaMfW6jWreaKh-oCSJpDosIZQ0-0GoakPxE5FJzysO2rghrla5MpK0dOhNwI3Y3HapxM7iKkYx86D4xKTGhtVh3MHr5tW5-pc2mxLIoNbqwzTm_xeUPi1y2IPNUOi8bsxi_tVkn4kjwRCrOVCQ4OaZ7tgZerfb26NoRvnGB6SN9B0nYNSWwYoXKIb1m2a1luoJY_5UbRI6VnFnddbhpSgSln7aY4dEukrbIpi8GoFLVRzn4zniofDLoddJWzCLHx-IOedNyIaMet2-jQ2UGqRp3nt1mVuxE1fg-cW3LDqF6_3JRrSrGW7DfbDY6p-PczqyyU1W5S0sHYRRl-5_go3oCWBf9PWFWjoVMB7d9w96u7SJOHIxp-pgmc2r_zvo7pjP8Wsrr0HVpohDLgGSaJerh0vUdIvkAGEQrVNIFnrGo7QqriFRTnku3ONEbhM04FjFB-TLCE6q2rdyEhkvF19RoWwwgdMUXhBZ1Q6C6nEzdwPd_3vOXUm7mLETqjcDmbBPf-zJ_OF0Hg-cF8cR2hP4wp2enk3lvO50tvtnD9IJi6rtb7oQ8lz-H6FwSyVRY)
 *
 * <br>
 *
 * The hierarchical arrangement of Scene components selected by Picker.rayPick is represented by a RayPickResult. This
 * structure enables the iteration of the chosen SceneObjects, and the iteration of the selected Meshes, Geometries, and
 * GeometryBuckets within each SceneObject. The structure goes all the way down to the chosen primitives, which can be
 * KdLine3D, KdPoint3D, or KdTriangle3D.
 *
 * A primitive has one or more vertex indices, and the number of indices is determined by the primitive type. These
 * indices are used to access the compressed vertex coordinates of the primitive within
 * GeometryBucket.positionsCompressed. These coordinates can be decompressed using Geometry.positionsDecompressMatrix and
 * then transformed into the World-space coordinate system using Mesh.matrix to obtain the final coordinates of the primitive.
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
 * ## Dependencies
 *
 * * {@link "@xeokit/scene"}
 * * {@link "@xeokit/core/components"}
 * * {@link "@xeokit/math/math"}
 * * {@link "@xeokit/math/boundaries"}
 *
 * ## Usage
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {SDKError} from "@xeokit/core/components";
 * import {TrianglesPrimitive, LinesPrimitive, PointsPrimitive} from "@xeokit/core/dist/constants";
 * import {KdTree3D, searchKdTree3DWithAABB} from "@xeokit/collision/objects";
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
 *     sceneModel.createMesh({
 *         id: "redLegMesh", geometryId: "theGeometry",
 *         position: [-4, -6, -4], scale: [1, 3, 1], rotation: [0, 0, 0], color: [1, 0.3, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "greenLegMesh", geometryId: "theGeometry", position: [4, -6, -4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 1.0, 0.3]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "blueLegMesh", geometryId: "theGeometry", position: [4, -6, 4],  scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [0.3, 0.3, 1.0]
 *     });
 *
 *     sceneModel.createMesh({
 *         id: "yellowLegMesh",  geometryId: "theGeometry", position: [-4, -6, 4], scale: [1, 3, 1],
 *         rotation: [0, 0, 0], color: [1.0, 1.0, 0.0]
 *     });
 *
 *     sceneModel.createMesh({
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
 *             // its SceneObjects into a SceneObjectsKdTree3D
 *
 *             const sceneObjectsKdTree3D = createSceneObjectsKdTree3D(Object.values(scene.objects));
 *
 *             // Then we'll try to ray-pick the SceneObjects
 *
 *             const picker = new Picker();
 *
 *             const rayPickResult = picker.rayPick({
 *                 sceneObjectsKdTree3D,
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
 *                 // Within each SceneObjectHit we get a MeshHit that wraps each Mesh that
 *                 // was picked in this SceneObject
 *
 *                 const meshHit = sceneObjectHit.meshHit;
 *                 const mesh = meshHit.mesh;
 *
 *                 // Within the MeshHit, a single GeometryHit that wraps
 *                 // the Geometry that was picked
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
 *                 // for each primitive that was hit within the GeometryBucket.
 *
 *                 // Each PrimtHit wraps a single a single KdPointPrim, KdLinePrim or KdTrianglePrim,
 *                 // which represents a point, line or triangle primitive, respectively.
 *
 *                 for (let j = 0, lenj = geometryBucketHit.primHits.length; j < lenj; j++) {
 *
 *                     const primHit = geometryBucketHit.primHits[j];
 *                     const primitive = primHit.primitive;
 *
 *                     // We know the primitive type from the Geometry
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
 * @module @xeokit/collision/pick
 */
export * from "./Picker";
export * from "./MarqueePickResult";
export * from "./RayPickResult";


