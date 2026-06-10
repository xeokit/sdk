/**
 * <img style="padding: 20px 0 30px;" src="../../assets/autzen.png"/>
 *
 * # xeokit LAS Importer
 *
 * ---
 *
 * **Import 3D LiDAR point cloud datasets into xeokit.**
 *
 * ---
 *
 * The xeokit SDK enables the import of 3D models from LAS, a widely used file format for exchanging 3D point cloud data.
 *
 * The LAS format is a standardized binary format that stores LiDAR-generated point cloud data. It includes metadata such as headers, point attributes, and supports both compressed and uncompressed data. LAS is widely used in industries like surveying, mapping, and urban planning.
 *
 * ### How it Works
 *
 * Use the {@link LASLoader} class to load LAS data into:
 * - a {@link model!scene.SceneModel | SceneModel} for rendering geometry
 * - a {@link model!data.DataModel | DataModel} for managing associated semantic information
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
 *     class LASLoader {
 *       +format : "LAS"
 *       +load(params, options?) Promise~void~
 *     }
 *     class LASLoaderOptions {
 *       +skip? : number
 *       +rotate? : boolean
 *       +layerId?
 *       +center? / fp64?
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- LASLoader
 *     LASLoader ..> LASLoaderOptions : reads
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **LAS + LAZ** — uncompressed and LASzip-compressed point
 *   clouds, common in surveying and lidar workflows.
 * - **Per-point colour + classification** — RGB attributes and
 *   point classification (ground, building, vegetation) preserved
 *   onto the SceneModel's geometry attributes.
 * - **Optional decimation** — `skip: N` keeps every Nth point;
 *   useful for previewing very dense clouds before importing the
 *   full set.
 * - **Coordinate-system aware** — `rotate: true` flips LAS's
 *   default +Z-up to xeokit's +Z-up world space (and vice versa).
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
 * ## Usage
 *
 * This example demonstrates how to:
 * - Set up a {@link viewing!viewer.Viewer | Viewer}, {@link model!scene.Scene | Scene}, and {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}
 * - Attach a {@link viewing!viewController.ViewController | ViewController} for interaction
 * - Load a LAS model using {@link LASLoader}
 * - Handle loading and error scenarios
 *
 * ```ts
 * import { SDKError } from "@xeokit/sdk/base/core";
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { LASLoader } from "@xeokit/sdk/formats/las";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *     scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 *
 * const viewResult = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas" // Ensure this HTMLElement exists in the page
 * });
 *
 * const view = viewResult.value;
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new ViewController(view, {});
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * const lasLoader = new LASLoader();
 *
 * fetch("model.laz")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         lasLoader.load({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         }).catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading LAS -> err}`);
 *         });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching or parsing LAS -> ${err}`);
 *     });
 * ```
 *
 * @module las
 */
export * from "./LASLoader";
export * from "./LASLoaderOptions";
