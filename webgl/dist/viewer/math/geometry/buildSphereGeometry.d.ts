import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a sphere-shaped {@link GeometryBucketHandle}.
 *
 * ## Usage
 *
 * Creating a {@link Mesh} with a sphere-shaped {@link GeometryBucketHandle} :
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildSphereGeometry)]
 *
 * ````javascript
 * import {WebViewer, Mesh, buildSphereGeometry, GeometryBucketHandle, PhongMaterial, Texture} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *     canvasId: "myView"
 * });
 *
 * viewer.camera.eye = [0, 0, 5];
 * viewer.camera.look = [0, 0, 0];
 * viewer.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new GeometryBucketHandle(viewer.scene, buildSphereGeometry({
 *          center: [0,0,0],
 *          radius: 1.5,
 *          heightSegments: 60,
 *          widthSegments: 60
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         diffuseMap: new Texture(viewer.scene, {
 *             src: "textures/diffuse/uvGrid2.jpg"
 *         })
 *      })
 * });
 * ````
 *
 * @function buildSphereGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link GeometryBucketHandle}, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.radius=1]  Radius.
 * @param [cfg.heightSegments=24] Number of latitudinal bands.
 * @param  {Number} [cfg.widthSegments=18] Number of longitudinal bands.
 * @returns {Object} Configuration for a {@link GeometryBucketHandle} subtype.
 */
declare function buildSphereGeometry(cfg?: {
    center: number[];
    heightSegments: number;
    radius: number;
    widthSegments: number;
}): GeometryArrays;
export { buildSphereGeometry };
