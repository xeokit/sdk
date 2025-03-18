/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * # xeokit LAS/LAZ Importer
 *
 * ---
 *
 * ### *Import 3D lidar point cloud datasets*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [LAS](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#las), a
 * file format for the interchange of 3-dimensional point cloud data.
 *
 * The LAS file format is a standardized binary format used for storing and sharing 3D point cloud data from LiDAR
 * scanners. It includes header information and point data attributes, supports compressed and uncompressed data, and
 * is widely used in surveying, mapping, and other industries.
 *
 * To import an LAS model into xeokit, use the {@link loadLAS} function, which will load the file into
 * a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel}.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNU01vozAQ_SvRnLYSiYA1NEFVpF3lmKpVua18cfHQuAXbso20NMp_r81H00jbaLmYeTPz3pvBHKFSHKGAqmHW7gR7MaylkkouDFZOKLnYP4V4yC_KCiXe-45mcaRy4R_Bx1M9v_p6OwaVQebwYYB-3IzYcycaPgccrTOqD-EpsM_8O-bYQH-NXRul0bi-xGt6I_aEDQtT2IPQl5nHM8t_WRwN7hXj-1_lI_NrsvMO7u50iNGh2W5HiBnD-t9dXaMZAfu5uYl-nvRf9A968HyFv9Y5iaZxVKPMDrU7TIB9E3rOofRNU-AMk7ZWpr2QbEbJs1bdyeHDB6mh7mJmCjGF5XJLIaFQfhnq-6rdedRJbM5c9nyTnZYBEbRoWia4v62DWQrugC1SKPwrx5p1jaPgTftS1jlV9rKCwpkOI-i0XzhO9xuKmjXWo8iFU-Z--gPCEYFmEooj_IVimZD16uc6I0lMbvM4I1kaQQ9FQvJVuo5JlqfJJickPUXwrpSnTVZxehvHab5J_ZNtQoPn-zMkg5HTBz5RHi8?type=png)](https://mermaid.live/edit#pako:eNqNU01vozAQ_SvRnLYSiYA1NEFVpF3lmKpVua18cfHQuAXbso20NMp_r81H00jbaLmYeTPz3pvBHKFSHKGAqmHW7gR7MaylkkouDFZOKLnYP4V4yC_KCiXe-45mcaRy4R_Bx1M9v_p6OwaVQebwYYB-3IzYcycaPgccrTOqD-EpsM_8O-bYQH-NXRul0bi-xGt6I_aEDQtT2IPQl5nHM8t_WRwN7hXj-1_lI_NrsvMO7u50iNGh2W5HiBnD-t9dXaMZAfu5uYl-nvRf9A968HyFv9Y5iaZxVKPMDrU7TIB9E3rOofRNU-AMk7ZWpr2QbEbJs1bdyeHDB6mh7mJmCjGF5XJLIaFQfhnq-6rdedRJbM5c9nyTnZYBEbRoWia4v62DWQrugC1SKPwrx5p1jaPgTftS1jlV9rKCwpkOI-i0XzhO9xuKmjXWo8iFU-Z--gPCEYFmEooj_IVimZD16uc6I0lMbvM4I1kaQQ9FQvJVuo5JlqfJJickPUXwrpSnTVZxehvHab5J_ZNtQoPn-zMkg5HTBz5RHi8)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * The example below shows how to use {@link las!loadLAS | loadLAS} in context.
 *
 * In this example, we will create a {@link viewer!Viewer | Viewer} with
 * a {@link webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link scene!Scene | Scene}, which holds model geometry
 * and materials.
 *
 * On our Viewer, we will create a single {@link viewer!View | View} to render it to a canvas element on the page. We will
 * also attach a {@link cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link scene!SceneModel | SceneModel} to hold model geometry and materials.
 *
 * We will then use {@link las!loadLAS | loadLAS} to load an LAS/LAZ file into our SceneModel.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {SDKError} from "@xeokit/sdk/core";
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Data} from "@xeokit/sdk/data";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {loadLAS} from "@xeokit/sdk/las";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const renderer = new WebGLRenderer({});
 *
 * const viewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer
 * });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("model.las").then(response => {
 *
 *     response.arrayBuffer().then(fileData => {
 *
 *          loadLAS({
 *                  fileData,
 *                  sceneModel,
 *                  dataModel,          // Optional DataModel
 *              },
 *              {,
 *                  fp64: false,        // Expect points as 64-bit floats? (optional, default is true)
 *                  colorDepth: "auto", // 8, 16 or "auto" (optional, default is "auto)
 *                  skip: 1,            // Load every nth point (optional, default is 1)
 *                  center: false,      // Whether to center the points (optional, default is false)
 *                  transform: [        // Transform the points (optional)
 *                      1,0,0,0,
 *                      0,1,0,0,
 *                      0,0,1,0,
 *                      0,0,0,1
 *                  ],
 *              }).then(() => {
 *                  sceneModel.build();
 *                  dataModel.build();
 *
 *              }).catch(err => {
 *
 *                  sceneModel.destroy();
 *                  dataModel.destroy();
 *
 *                  console.error(`Error loading LAS/LAZ file: ${err}`);
 *              });
 *         }).catch(err => {
 *              console.error(`Error creating ArrayBuffer: ${err}`);
 *         });
 *     }).catch(err => {
 *          console.error(`Error fetching model: ${err}`);
 *     });
 * ````
 *
 * @module las
 */
export * from "./loadLAS";
//# sourceMappingURL=index.js.map