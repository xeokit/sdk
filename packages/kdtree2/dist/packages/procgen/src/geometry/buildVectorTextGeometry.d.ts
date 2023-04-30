import type { GeometryArrays } from "./GeometryArrays";
/**
 * Creates wireframe vector text {@link @xeokit/scene!Geometry}.
 *
 * ## Usage
 *
 * Creating a {@link Mesh} with vector text {@link ReadableGeometry} :
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#geometry_builders_buildVectorTextGeometry)]
 *
 * ````javascript
 *
 * import {Viewer, Mesh, buildVectorTextGeometry, ReadableGeometry, PhongMaterial} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *      canvasId: "myView"
 * });
 *
 * viewer.camera.eye = [0, 0, 100];
 * viewer.camera.look = [0, 0, 0];
 * viewer.camera.up = [0, 1, 0];
 *
 * new Mesh(viewer.scene, {
 *      geometry: new ReadableGeometry(viewer.scene, buildVectorTextGeometry({
 *          origin: [0,0,0],
 *          text: "On the other side of the screen, it all looked so easy"
 *      }),
 *      material: new PhongMaterial(viewer.scene, {
 *         diffuseMap: new Texture(viewer.scene, {
 *             src: "textures/diffuse/uvGrid2.jpg"
 *         })
 *      })
 * });
 * ````
 *
 * @function buildVectorTextGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.origin] 3D point indicating the top left corner.
 * @param [cfg.size=1] Size of each character.
 * @param [cfg.text=""] The text.
 * @returns {Object} Configuration for a {@link @xeokit/scene!Geometry} subtype.
 */
export declare function buildVectorTextGeometry(cfg?: {
    size: number;
    origin: number[];
    text: string;
}): GeometryArrays;
