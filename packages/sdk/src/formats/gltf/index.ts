/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/xeokit_gltf_logo.svg"/>
 *
 * # gltf — glTF Importer
 *
 * Import models using the industry-standard
 * {@link https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#gltf | glTF}
 * (GL Transmission Format).
 *
 * ## Overview
 *
 * The xeokit SDK provides support for loading **glTF**, a compact, efficient,
 * and royalty-free format designed for fast delivery of 3D assets in real-time
 * applications and web browsers.
 *
 * glTF is widely used for:
 *
 * - runtime asset delivery
 * - web-based 3D visualization
 * - interchange between 3D tools and engines
 *
 * A glTF asset may contain:
 *
 * - geometry and materials
 * - textures
 * - a hierarchical scene graph
 *
 * ---
 *
 * ## Importing glTF
 *
 * Use {@link GLTFLoader} to load glTF (JSON `.gltf` or binary `.glb`) file data into xeokit.
 *
 * The loader populates:
 *
 * - a {@link model!scene.SceneModel | SceneModel} with geometry and materials
 * - optionally, a {@link model!data.DataModel | DataModel} that mirrors the glTF node hierarchy
 *
 * This allows applications to render glTF content while also retaining
 * structural information about the model’s scene graph.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class GLTFLoader {
 *       +format : "glTF"
 *       +load(params, options?) Promise~void~
 *     }
 *     class GLTFExporter {
 *       +format : "glTF"
 *       +write(params, options?) Promise~Uint8Array~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     class SceneModel {
 *       <<scene>>
 *     }
 *     class DataModel {
 *       <<data>>
 *     }
 *     ModelLoader <|-- GLTFLoader
 *     ModelExporter <|-- GLTFExporter
 *     GLTFLoader ..> SceneModel : writes
 *     GLTFLoader ..> DataModel : writes nodes
 *     GLTFExporter ..> SceneModel : reads
 *     GLTFExporter ..> DataModel : reads
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **`.gltf` + `.glb`** — JSON and binary container variants.
 * - **Full PBR materials** — colour / metallic-roughness / normal /
 *   occlusion / emissive textures map to
 *   {@link model!scene.SceneMaterial | SceneMaterial} verbatim.
 * - **Node hierarchy → DataModel** — optionally mirrors the glTF
 *   scene-graph node tree into a {@link model!data.DataModel | DataModel}
 *   so picking and inspection see one coherent semantic graph.
 * - **Round-trip** — `GLTFExporter` writes a SceneModel back to
 *   `.glb`, reusing accessors across meshes that share geometry.
 * - **Texture pass-through** — already-encoded PNG / JPEG bytes
 *   from `SceneTexture.buffers` / `src` are preserved verbatim on
 *   export.
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
 * ## Example: loading a glTF model
 *
 * The following example demonstrates a complete flow:
 *
 * - create a {@link viewing!viewer.Viewer | Viewer} and {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}
 * - create a {@link viewing!viewer.View | View} bound to a canvas
 * - load a binary glTF (`.glb`) file into a {@link model!scene.SceneModel | SceneModel}
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { GLTFLoader } from "@xeokit/sdk/formats/gltf";
 *
 * // 1) Create containers for geometry and optional structural data
 * const scene = new Scene();
 * const data  = new Data();
 *
 * // 2) Create a Viewer and WebGL renderer
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * // 3) Create a View bound to an existing canvas element
 * const view = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas" // Ensure this element exists
 * }).value;
 *
 * // 4) Position the camera
 * view.camera.eye  = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up   = [0, 1, 0];
 *
 * // 5) Enable mouse / touch camera interaction
 * new ViewController(view, {});
 *
 * // 6) Create target models for the loader
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 * const dataModel  = data.createModel({ id: "myModel" }).value;
 *
 * // 7) Create the glTF loader
 * const glTFLoader = new GLTFLoader();
 *
 * // 8) Fetch and decode the binary glTF file
 * fetch("model.glb")
 *   .then(r => r.arrayBuffer())
 *   .then(fileData => {
 *
 *     // 9) Load geometry (and optional node hierarchy) into the models
 *     return glTFLoader.load({
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
 *     console.error("Error loading glTF:", err);
 *   });
 * ```
 *
 * ---
 *
 * ## Notes
 *
 * - glTF loading is optimized for **runtime use**, not authoring-time editing.
 * - The optional DataModel reflects the glTF node hierarchy, not BIM-level semantics.
 *
 * @module gltf
 */
export * from "./GLTFLoader";
export * from "./GLTFExporter";
export type {GLTFLoadOptions} from "./GLTFLoadOptions";
