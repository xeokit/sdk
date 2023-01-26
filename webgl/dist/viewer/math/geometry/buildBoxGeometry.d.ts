import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates box-shaped geometry arrays.
 *
 * ## Usage
 *
 * In the example below we'll create a {@link Mesh} with a box-shaped {@link GeometryBucketHandle}.
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildBoxGeometry)]
 *
 * ````javascript
 * import {WebViewer, Mesh, buildBoxGeometry, GeometryBucketHandle, PhongMaterial, Texture} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *         canvasId: "myView"
 * });
 *
 * viewer.scene.camera.eye = [0, 0, 5];
 * viewer.scene.camera.look = [0, 0, 0];
 * viewer.scene.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new GeometryBucketHandle(viewer.scene, buildBoxGeometry({
 *         center: [0,0,0],
 *         xSize: 1,  // Half-size on each axis
 *         ySize: 1,
 *         zSize: 1
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         diffuseMap: new Texture(viewer.scene, {
 *             src: "textures/diffuse/uvGrid2.jpg"
 *         })
 *      })
 * });
 * ````
 *
 * @function buildBoxGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.xSize=1.0]  Half-size on the X-axis.
 * @param [cfg.ySize=1.0]  Half-size on the Y-axis.
 * @param [cfg.zSize=1.0]  Half-size on the Z-axis.
 * @returns {Object} GeometryBucketHandle arrays.
 */
declare function buildBoxGeometry(cfg?: {
    center?: number[];
    ySize?: number;
    xSize?: number;
    zSize?: number;
}): GeometryArrays;
export { buildBoxGeometry };
