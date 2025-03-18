/**
 * <img style="padding: 20px 0 30px;" src="https://xeokit.github.io/sdk/docs/assets/autzen.png"/>
 *
 * # xeokit LAS/LAZ Importer
 *
 * ---
 *
 * **Import 3D LiDAR point cloud datasets into xeokit.**
 *
 * ---
 *
 * The xeokit SDK enables the import of 3D models from [LAS](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#las),
 * a widely used file format for exchanging 3D point cloud data.
 *
 * The LAS format is a standardized binary format that stores LiDAR-generated point cloud data.
 * It includes metadata such as headers, point attributes, and supports both compressed and uncompressed data.
 * LAS is widely used in industries like surveying, mapping, and urban planning.
 *
 * To import an LAS model into xeokit, use the {@link loadLAS} function to load the file into
 * a {@link scene!SceneModel | SceneModel} and a {@link data!DataModel | DataModel}.
 *
 * ---
 *
 * ![Workflow](https://mermaid.ink/img/pako:eNqNU01vozAQ_SvRnLYSiYA1NEFVpF3lmKpVua18cfHQuAXbso20NMp_r81H00jbaLmYeTPz3pvBHKFSHKGAqmHW7gR7MaylkkouDFZOKLnYP4V4yC_KCiXe-45mcaRy4R_Bx1M9v_p6OwaVQebwYYB-3IzYcycaPgccrTOqD-EpsM_8O-bYQH-NXRul0bi-xGt6I_aEDQtT2IPQl5nHM8t_WRwN7hXj-1_lI_NrsvMO7u50iNGh2W5HiBnD-t9dXaMZAfu5uYl-nvRf9A968HyFv9Y5iaZxVKPMDrU7TIB9E3rOofRNU-AMk7ZWpr2QbEbJs1bdyeHDB6mh7mJmCjGF5XJLIaFQfhnq-6rdedRJbM5c9nyTnZYBEbRoWia4v62DWQrugC1SKPwrx5p1jaPgTftS1jlV9rKCwpkOI-i0XzhO9xuKmjXWo8iFU-Z--gPCEYFmEooj_IVimZD16uc6I0lMbvM4I1kaQQ9FQvJVuo5JlqfJJickPUXwrpSnTVZxehvHab5J_ZNtQoPn-zMkg5HTBz5RHi8)
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * The following example demonstrates how to use {@link las!loadLAS | loadLAS}.
 *
 * First, we create a {@link viewer!Viewer | Viewer} with a
 * {@link webglrenderer!WebGLRenderer | WebGLRenderer} and a {@link scene!Scene | Scene}
 * to manage the 3D scene.
 *
 * We also define a single {@link viewer!View | View} to render the scene on a canvas.
 * A {@link cameracontrol!CameraControl | CameraControl} is attached to the view,
 * allowing interaction via mouse and touch input.
 *
 * Next, we create a {@link scene!SceneModel | SceneModel} to store the model geometry and materials.
 * Finally, we use {@link las!loadLAS | loadLAS} to load an LAS/LAZ file into the SceneModel.
 *
 * ```javascript
 * import { SDKError } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { loadLAS } from "@xeokit/sdk/las";
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
 *     elementId: "myCanvas" // Ensure this HTMLElement exists in the page
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({ id: "myModel" });
 * const dataModel = data.createModel({ id: "myModel" });
 *
 * fetch("model.las")
 *     .then(response => response.arrayBuffer())
 *     .then(fileData => {
 *         loadLAS(
 *             {
 *                 fileData,
 *                 sceneModel,
 *                 dataModel // Optional
 *             },
 *             {
 *                 fp64: false,        // Expect points as 64-bit floats? (default: true)
 *                 colorDepth: "auto", // 8, 16, or "auto" (default: "auto")
 *                 skip: 1,            // Load every nth point (default: 1)
 *                 center: false,      // Center the points? (default: false)
 *                 transform: [        // Optional transformation matrix
 *                     1, 0, 0, 0,
 *                     0, 1, 0, 0,
 *                     0, 0, 1, 0,
 *                     0, 0, 0, 1
 *                 ]
 *             }
 *         )
 *         .then(() => {
 *             sceneModel.build();
 *             dataModel.build();
 *         })
 *         .catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading LAS/LAZ file: ${err}`);
 *         });
 *     })
 *     .catch(err => console.error(`Error fetching model: ${err}`));
 * ```
 *
 * @module las
 */
export * from "./loadLAS";
//# sourceMappingURL=index.d.ts.map
