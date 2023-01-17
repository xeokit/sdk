import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates a torus-shaped {@link GeometryBucketHandle}.
 *
 * ## Usage
 * Creating a {@link Mesh} with a torus-shaped {@link GeometryBucketHandle} :
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildTorusGeometry)]
 *
 * ````javascript
 * import {WebViewer, Mesh, buildTorusGeometry, GeometryBucketHandle, PhongMaterial, Texture} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *      canvasId: "myCanvas"
 * });
 *
 * viewer.camera.eye = [0, 0, 5];
 * viewer.camera.look = [0, 0, 0];
 * viewer.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new GeometryBucketHandle(viewer.scene, buildTorusGeometry({
 *          center: [0,0,0],
 *          radius: 1.0,
 *          tube: 0.5,
 *          radialSegments: 32,
 *          tubeSegments: 24,
 *          arc: Math.PI * 2.0
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         diffuseMap: new Texture(viewer.scene, {
 *             src: "textures/diffuse/uvGrid2.jpg"
 *         })
 *      })
 * });
 * ````
 *
 * @function buildTorusGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link GeometryBucketHandle}, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center] 3D point indicating the center position.
 * @param [cfg.radius=1] The overall radius.
 * @param [cfg.tube=0.3] The tube radius.
 * @param [cfg.radialSegments=32] The number of radial segments.
 * @param [cfg.tubeSegments=24] The number of tubular segments.
 * @param [cfg.arc=Math.PI*0.5] The length of the arc in radians, where Math.PI*2 is a closed torus.
 * @returns {Object} Configuration for a {@link GeometryBucketHandle} subtype.
 */
declare function buildTorusGeometry(cfg?: {
    tube?: number;
    arc?: number;
    center?: number[];
    radialSegments?: number;
    radius?: number;
    tubeSegments?: number;
}): GeometryArrays;
export { buildTorusGeometry };
