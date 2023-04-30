import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a box-shaped lines {@link @xeokit/scene!Geometry}.
 *
 * ## Usage
 *
 * In the example below we'll create a {@link Mesh} with a box-shaped {@link ReadableGeometry} that has lines primitives.
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildBoxLinesGeometry)]
 *
 * ````javascript
 * import {Viewer, Mesh, buildBoxLinesGeometry, ReadableGeometry, PhongMaterial} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *         canvasId: "myView"
 * });
 *
 * viewer.scene.camera.eye = [0, 0, 5];
 * viewer.scene.camera.look = [0, 0, 0];
 * viewer.scene.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new ReadableGeometry(viewer.scene, buildBoxLinesGeometry({
 *         center: [0,0,0],
 *         xSize: 1,  // Half-size on each axis
 *         ySize: 1,
 *         zSize: 1
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         emissive: [0,1,0]
 *      })
 * });
 * ````
 *
 * @function buildBoxLinesGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.xSize=1.0]  Half-size on the X-axis.
 * @param [cfg.ySize=1.0]  Half-size on the Y-axis.
 * @param [cfg.zSize=1.0]  Half-size on the Z-axis.
 * @returns {Object} Configuration for a {@link @xeokit/scene!Geometry} subtype.
 */
export declare function buildBoxLinesGeometry(cfg?: {
    center?: (number[] | Float32Array | Float64Array);
    ySize?: number;
    xSize?: number;
    zSize?: number;
}): GeometryArrays;
