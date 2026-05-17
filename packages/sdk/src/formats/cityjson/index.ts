/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/cityJSONLogo.svg"/>
 *
 * # cityjson — CityJSON Importer
 *
 * Import and visualize 3D urban models using the
 * {@link https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson | CityJSON}
 * format.
 *
 * ## Overview
 *
 * The xeokit SDK supports importing **CityJSON**, a lightweight, open,
 * JSON-based format for representing 3D city models.
 *
 * CityJSON is designed as a simpler, more developer-friendly alternative to
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
 * ## Importing CityJSON
 *
 * Use {@link CityJSONLoader} to load CityJSON data into xeokit.
 *
 * The loader populates:
 *
 * - a {@link model!scene.SceneModel | SceneModel} with renderable geometry
 * - a {@link model!data.DataModel | DataModel} with semantic and structural information
 *
 * This separation allows applications to visualize large urban models while
 * still querying and analyzing their underlying city objects.
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
 *     class CityJSONLoader {
 *       +format : "CityJSON"
 *       +load(params, options?) Promise~void~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- CityJSONLoader
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **CityJSON 1.1** — the OGC standard for city models;
 *   buildings, terrain, roads, vegetation.
 * - **Solid + Surface primitives** — polyhedral solids tessellate
 *   into TrianglesPrimitive meshes via `earcut`; surface
 *   collections become `SurfacePrimitive` meshes.
 * - **Per-feature semantics** — CityJSON `Feature`s become
 *   {@link model!data.DataObject | DataObjects} with their original
 *   id + type preserved.
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
 * ## Example: loading a CityJSON model (with error checking)
 *
 * The following example demonstrates a complete CityJSON import workflow,
 * including explicit error handling for all xeokit factory calls.
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { CityJSONLoader } from "@xeokit/sdk/formats/cityjson";
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
 * new ViewController(view, {});
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
 * // 7) Create the CityJSON loader
 * const cityJSONLoader = new CityJSONLoader();
 *
 * // 8) Fetch and parse the CityJSON file
 * fetch("model.json")
 *   .then(r => r.json())
 *   .then(fileData => {
 *
 *     // 9) Load geometry and semantics into the models
 *     return cityJSONLoader.load({
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
 *     handleError(`Error loading CityJSON -> ${err}`);
 *   });
 * ```
 *
 * ---
 *
 * ## Notes
 *
 * - CityJSON is well suited for **large-scale urban visualization**.
 * - The resulting {@link model!data.DataModel | DataModel} exposes city objects and
 *   their attributes for querying and analysis.
 *
 * @module cityjson
 */
export * from "./CityJSONLoader";
