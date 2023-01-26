import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a plane-shaped {@link GeometryBucketHandle}.
 *
 * ## Usage
 *
 * Creating a {@link Mesh} with a PlaneGeometry and a {@link PhongMaterial} with diffuse {@link Texture}:
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildPlaneGeometry)]
 *
 * ````javascript
 * import {WebViewer, Mesh, buildPlaneGeometry, GeometryBucketHandle, PhongMaterial, Texture} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *      canvasId: "myView"
 * });
 *
 * viewer.camera.eye = [0, 0, 5];
 * viewer.camera.look = [0, 0, 0];
 * viewer.camera.up = [0, 1, 0];

 * new Mesh(viewer.scene, {
 *      geometry: new GeometryBucketHandle(viewer.scene, buildPlaneGeometry({
 *          center: [0,0,0],
 *          xSize: 2,
 *          zSize: 2,
 *          xSegments: 10,
 *          zSegments: 10
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *          diffuseMap: new Texture(viewer.scene, {
 *              src: "textures/diffuse/uvGrid2.jpg"
 *          })
 *      })
 *  });
 * ````
 *
 * @function buildPlaneGeometry
 * @param cfg Configs
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.id] Optional ID for the {@link GeometryBucketHandle}, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.xSize=1] Dimension on the X-axis.
 * @param [cfg.zSize=1] Dimension on the Z-axis.
 * @param [cfg.xSegments=1] Number of segments on the X-axis.
 * @param [cfg.zSegments=1] Number of segments on the Z-axis.
 * @returns {Object} Configuration for a {@link GeometryBucketHandle} subtype.
 */
declare function buildPlaneGeometry(cfg?: {
    xSize: number;
    zSize: number;
    xSegments: number;
    center: number[];
}): GeometryArrays;
export { buildPlaneGeometry };
