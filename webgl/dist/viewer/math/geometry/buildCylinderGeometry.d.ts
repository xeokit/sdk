import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a cylinder-shaped {@link GeometryBucketHandle}.
 *
 * ## Usage
 *
 * Creating a {@link Mesh} with a cylinder-shaped {@link GeometryBucketHandle} :
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildCylinderGeometry)]
 *
 * ````javascript
 *
 * import {WebViewer, Mesh, buildCylinderGeometry, GeometryBucketHandle, PhongMaterial, Texture} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *      canvasId: "myView"
 *  });
 *
 * viewer.camera.eye = [0, 0, 5];
 * viewer.camera.look = [0, 0, 0];
 * viewer.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new ReadableGeometry(viewer.scene, buildCylinderGeometry({
 *          center: [0,0,0],
 *          radiusTop: 2.0,
 *          radiusBottom: 2.0,
 *          height: 5.0,
 *          radialSegments: 20,
 *          heightSegments: 1,
 *          openEnded: false
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         diffuseMap: new Texture(viewer.scene, {
 *             src: "textures/diffuse/uvGrid2.jpg"
 *         })
 *      })
 * });
 * ````
 *
 * @function buildCylinderGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link GeometryBucketHandle}, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.radiusTop=1]  Radius of top.
 * @param [cfg.radiusBottom=1]  Radius of bottom.
 * @param [cfg.height=1] Height.
 * @param [cfg.radialSegments=60]  Number of horizontal segments.
 * @param [cfg.heightSegments=1]  Number of vertical segments.
 * @param [cfg.openEnded=false]  Whether or not the cylinder has solid caps on the ends.
 * @returns {Object} Configuration for a {@link GeometryBucketHandle} subtype.
 */
declare function buildCylinderGeometry(cfg?: {
    radiusBottom: number;
    center: (number[] | Float32Array | Float64Array);
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
    radiusTop: number;
    height: number;
}): GeometryArrays;
export { buildCylinderGeometry };
