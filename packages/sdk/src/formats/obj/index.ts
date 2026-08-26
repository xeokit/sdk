/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/obj_logo.png"/>
 *
 * # obj — OBJ Importer
 *
 * Import and visualize 3D urban models using the
 * {@link https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#obj | OBJ}
 * format.
 *
 * ## Overview
 *
 * The xeokit SDK supports importing **OBJ**, a lightweight, open,
 * JSON-based format for representing 3D city models.
 *
 * OBJ is designed as a simpler, more developer-friendly alternative to
 * CityGML, while preserving the same conceptual model. It is commonly used
 * to represent:
 *
 * - buildings and building parts
 * - terrain and land use
 * - transportation networks
 * - vegetation and city furniture
 *
 * ---
 *
 * ## Importing OBJ
 *
 * Use {@link OBJLoader} to load OBJ data into xeokit.
 *
 * The loader populates:
 *
 * - a {@link model!scene.SceneModel | SceneModel} with renderable geometry
 * - a {@link model!data.DataModel | DataModel} with semantic and structural information
 *
 * ---
 *
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class OBJLoader {
 *       +format : "OBJ"
 *       +load(params, options?) Promise~void~
 *     }
 *     class OBJExporter {
 *       +format : "OBJ"
 *       +write(params, options?) Promise~string~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- OBJLoader
 *     ModelExporter <|-- OBJExporter
 *     OBJLoader ..> MTLLoader : optional materials
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Wavefront OBJ** — classic plain-text mesh format; pairs with
 *   {@link formats!mtl | MTL} material files.
 * - **Groups → SceneObjects** — every OBJ `g` group becomes one
 *   SceneObject; pair an `o` line at the top to give the whole
 *   model a single root id.
 * - **Round-trip** — `OBJExporter` writes SceneModel meshes back
 *   to OBJ, with an optional matching MTL.
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Example: loading a OBJ model (with error checking)
 *
 * The following example demonstrates a complete OBJ import workflow,
 * including explicit error handling for all xeokit factory calls.
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/renderers/webGL";
 * import { ModelNavigationController } from "@xeokit/sdk/viewing/navigation/model";
 * import { OBJLoader } from "@xeokit/sdk/formats/obj";
 *
 * const handleError = (error: string) => {
 *   console.error(error);
 * };
 *
 * // 1) Create containers for geometry and city semantics
 * const scene = new Scene();
 * const data  = new Data();
 *
 * // 2) Create Viewer and WebGL renderer
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * // 3) Create a View bound to an existing canvas element
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas" // Ensure this HTMLElement exists
 * });
 *
 * if (viewResult.ok === false) {
 *   handleError(viewResult.error);
 *   return;
 * }
 *
 * const view = viewResult.value;
 *
 * // 4) Position the camera
 * view.camera.eye  = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up   = [0, 1, 0];
 *
 * // 5) Enable interactive camera control
 * new ModelNavigationController(view, {});
 *
 * // 6) Create target models for the loader
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * if (sceneModelResult.ok === false) {
 *   handleError(sceneModelResult.error);
 *   return;
 * }
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * if (dataModelResult.ok === false) {
 *   handleError(dataModelResult.error);
 *   sceneModelResult.value.destroy();
 *   return;
 * }
 *
 * const sceneModel = sceneModelResult.value;
 * const dataModel  = dataModelResult.value;
 *
 * // 7) Create the OBJ loader
 * const oBJLoader = new OBJLoader();
 *
 * // 8) Fetch and parse the OBJ file
 * fetch("model.obj")
 *   .then(r => r.text())
 *   .then(fileData => {
 *
 *     // 9) Load geometry and semantics into the models
 *     return oBJLoader.load({
 *       fileData,
 *       sceneModel,
 *       dataModel
 *     });
 *   })
 *   .then(() => {
 *     // Model successfully loaded and visible
 *   })
 *   .catch(err => {
 *     // Clean up on failure
 *     sceneModel.destroy();
 *     dataModel.destroy();
 *     handleError(`Error loading OBJ -> ${err}`);
 *   });
 * ```
 *
 * @module obj
 */
export * from "./OBJLoader";
export * from "./OBJExporter";
