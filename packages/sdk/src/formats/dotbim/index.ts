/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; width:180px;"
 *      src="../../assets/dotbim-logo.png"/>
 *
 * # dotbim — .BIM Importer and Exporter
 *
 * Import and export the open, free, and simple
 * {@link https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dotbim | .BIM} model format.
 *
 * ## Overview
 *
 * The xeokit SDK provides first-class support for the **.BIM** format: a lightweight,
 * JSON-based 3D model format designed for:
 *
 * - easy sharing
 * - human readability
 * - minimal parsing overhead
 *
 * A `.bim` file contains:
 *
 * - triangulated geometry
 * - materials
 * - a compact dictionary of semantic metadata
 *
 * This makes it well suited for streamlined BIM and conversion workflows where
 * simplicity and transparency are important.
 *
 * ---
 *
 * ## Importing .BIM
 *
 * Use {@link DotBIMLoader} to load `.bim` file data into xeokit:
 *
 * - a {@link model!scene.SceneModel | SceneModel} receives geometry and materials
 * - a {@link model!data.DataModel | DataModel} receives semantic metadata
 *
 * The loader is **data-driven**: you provide already-parsed JSON, along with target
 * models, and the loader populates them.
 *
 * ---
 *
 * ## Exporting .BIM
 *
 * Use {@link DotBIMExporter} to serialize xeokit models back into `.bim` data.
 *
 * You can export:
 *
 * - a {@link model!scene.SceneModel | SceneModel}
 * - a {@link model!data.DataModel | DataModel}
 *
 * into a single `.bim` JSON structure suitable for storage or transfer.
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
 *     class DotBIMLoader {
 *       +format : "DotBIM"
 *       +load(params, options?) Promise~void~
 *     }
 *     class DotBIMExporter {
 *       +format : "DotBIM"
 *       +write(params, options?) Promise~string~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- DotBIMLoader
 *     ModelExporter <|-- DotBIMExporter
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Single-file JSON BIM** — DotBIM ships geometry + semantics
 *   in one `.bim` file; ideal for small-to-medium BIM exchanges
 *   that don't justify IFC's complexity.
 * - **Round-trip** — `DotBIMExporter` writes a SceneModel +
 *   DataModel back to DotBIM 1.1, preserving element types,
 *   info dictionaries, and triangle meshes.
 * - **Per-element info** — every DotBIM element carries an
 *   `info: {...}` map; the loader writes those keys into the
 *   matching DataObject's {@link model!data.PropertySet | PropertySets}.
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
 * ## Example: loading a .BIM model
 *
 * The following example shows the full flow for loading and displaying a `.bim`
 * model in a {@link viewing!viewer.Viewer | Viewer}.
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";
 *
 * // 1) Create core containers for geometry and metadata
 * const scene = new Scene();
 * const data  = new Data();
 *
 * // 2) Create a Viewer to render the Scene
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * // 3) Create a View bound to a canvas element
 * const view = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas"
 * }).value;
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
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 * const dataModel  = data.createModel({ id: "myModel" }).value;
 *
 * // 7) Create the .BIM loader
 * const dotBIMLoader = new DotBIMLoader();
 *
 * // 8) Fetch and parse the .BIM JSON
 * fetch("model.bim")
 *   .then(r => r.json())
 *   .then(fileData => {
 *
 *     // 9) Load geometry + metadata into the models
 *     return dotBIMLoader.load({
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
 *     console.error("Error loading .BIM:", err);
 *   });
 * ```
 *
 * ---
 *
 * ## Example: exporting to .BIM
 *
 * ```ts
 * import { DotBIMExporter } from "@xeokit/sdk/formats/dotbim";
 *
 * const exporter = new DotBIMExporter();
 *
 * // 1) Serialize models to .BIM JSON
 * exporter.write({
 *   sceneModel,
 *   dataModel,
 *   version: "1.1.0" // Optional; defaults to latest supported version
 * })
 * .then(fileData => {
 *   // fileData is a plain JS object ready for JSON.stringify(...)
 * })
 * .catch(err => {
 *   console.error("Error exporting .BIM:", err);
 * });
 * ```
 *
 * ---
 *
 * ## Notes
 *
 * - `.bim` is intentionally minimal; xeokit does not attempt to infer missing BIM
 *   semantics beyond what the format provides.
 * - Import and export are symmetric: loading a `.bim` and exporting it again
 *   will preserve structure where possible.
 *
 * @module dotbim
 */
export * from "./DotBIMLoader";
export * from "./DotBIMExporter";
