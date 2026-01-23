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
 * - a {@link scene!SceneModel | SceneModel} with geometry and materials
 * - optionally, a {@link data!DataModel | DataModel} that mirrors the glTF node hierarchy
 *
 * This allows applications to render glTF content while also retaining
 * structural information about the model’s scene graph.
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
 * - create a {@link viewer!Viewer | Viewer} and {@link webglrenderer!WebGLRenderer | WebGLRenderer}
 * - create a {@link viewer!View | View} bound to a canvas
 * - load a binary glTF (`.glb`) file into a {@link scene!SceneModel | SceneModel}
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
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
 * new CameraControl(view, {});
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
