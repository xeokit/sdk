/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit 3D Gaussian Splatting Importer / Exporter
 *
 * ---
 *
 * **Import and export 3D Gaussian Splatting reality-capture scenes in the compact `.splat` format**
 *
 * ---
 *
 * 3D Gaussian Splatting (3DGS) represents a scene as a cloud of anisotropic 3D
 * gaussians — each with a position, a covariance (orientation + scale), a colour
 * and an opacity — rendered as depth-sorted, alpha-blended screen-space splats.
 * It is the format of choice for photoreal reality capture: real-estate tours,
 * scanned environments, and as-built / BIM context alongside CAD geometry.
 *
 * The xeokit SDK imports and exports the compact **`.splat`** encoding (32 bytes
 * per splat — position, scale, RGBA colour and a rotation quaternion; baked RGB,
 * no spherical harmonics) as a first-class {@link model!scene.SceneModel | SceneModel}
 * primitive. A splat scene therefore loads, streams, transforms and picks
 * exactly like any other model, renders through the WebGL renderer's dedicated
 * EWA gaussian-splat pass, and writes back out to `.splat` for round-tripping.
 *
 * ### Importing `.splat` scenes
 *
 * Use the {@link GaussianSplatLoader} class to load `.splat` file data into a
 * {@link model!scene.SceneModel | SceneModel}. The loader creates one
 * {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 * geometry, a mesh and an object. No {@link model!data.DataModel | DataModel}
 * is involved — `.splat` carries no semantic data.
 *
 * ### Exporting `.splat` scenes
 *
 * Use the {@link GaussianSplatExporter} class to write a
 * {@link model!scene.SceneModel | SceneModel}'s
 * {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 * geometries back to `.splat` bytes. It round-trips with the loader: a scene
 * loaded and then re-exported reproduces the original splats (positions to
 * within 16-bit position quantisation; scales, colours and rotations exactly).
 *
 * ```ts
 * import { GaussianSplatExporter } from "@xeokit/sdk/formats/gaussiansplat";
 *
 * const fileData = await new GaussianSplatExporter().write({ sceneModel });
 * // fileData is an ArrayBuffer of .splat bytes, ready to download or re-load.
 * ```
 *
 * ---
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class GaussianSplatLoader {
 *       +format : "splat"
 *       +versions : ["*"]
 *       +load(params, options?) Promise~void~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class GaussianSplatExporter {
 *       +format : "splat"
 *       +versions : ["*"]
 *       +write(params, options?) Promise~ArrayBuffer~
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- GaussianSplatLoader
 *     ModelExporter <|-- GaussianSplatExporter
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Compact `.splat`** — 32 bytes per splat (position, scale,
 *   RGBA colour, rotation quaternion); baked RGB, no spherical
 *   harmonics, so scenes of ~1M+ splats stream and render cheaply.
 * - **First-class SceneModel primitive** — splats import as
 *   {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 *   geometry, so they stream in and out, transform and pick like
 *   any other xeokit model rather than living in a bolt-on viewer.
 * - **EWA splatting** — each splat's anisotropic 3D covariance is
 *   projected to a screen-space gaussian, depth-sorted back-to-front
 *   and alpha-blended by the renderer's dedicated splat pass; the
 *   depth sort runs off the main thread.
 * - **Coordinate-system aware** — `.splat` / COLMAP scenes are authored
 *   Y-down; splats load in that native frame, and you stand them upright
 *   in the SDK's right-handed Z-up world by configuring the source frame
 *   on the SceneModel's
 *   {@link model!scene.SceneModel.coordinateSystem | coordinateSystem}
 *   rather than baking a correction into the geometry.
 * - **Transformable & pickable** — set `splatMesh.matrix` to move or
 *   animate the scene after load, and click to pick the world-space
 *   surface position of a splat, the same as triangle geometry.
 * - **Round-trip export** — write a SceneModel's splat geometries back
 *   to `.splat` with {@link GaussianSplatExporter}. Scales, colours and
 *   rotations survive exactly; positions to within the 16-bit position
 *   quantisation. Geometry is written in its stored frame (any orientation
 *   fix lives on the SceneModel's coordinate system, not the geometry), so
 *   a loaded → exported file keeps its original orientation.
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
 * Loading and displaying a `.splat` scene in a {@link viewing!viewer.Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { GaussianSplatLoader } from "@xeokit/sdk/formats/gaussiansplat";
 *
 * const scene = new Scene();
 *
 * const viewer = new Viewer({ scene });
 *
 * new WebGLRenderer({ viewer });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * }).value;
 *
 * // The SDK world is right-handed Z-up.
 * view.camera.eye  = [3, 3, 3];
 * view.camera.look = [0, 0, 0];
 * view.camera.up   = [0, 0, 1];
 *
 * new ViewController(view, {});
 *
 * // .splat scenes are authored Y-down. Declare that source frame on the model's
 * // coordinate system (basis columns are Right, Up, Forward) so the splats stand
 * // upright in the Scene's Z-up world — here Up = -Y.
 * const sceneModel = scene.createModel({
 *     id: "myModel",
 *     coordinateSystem: {
 *         basis: [
 *             1,  0, 0,  // Right   (+X)
 *             0, -1, 0,  // Up      (-Y, the Y-down source up-axis)
 *             0,  0, 1,  // Forward (+Z)
 *         ],
 *         origin: [0, 0, 0],
 *         units: "meters",
 *     },
 * }).value;
 *
 * const gaussianSplatLoader = new GaussianSplatLoader();
 *
 * fetch("scene.splat")
 *     .then(response => response.arrayBuffer())
 *     .then(fileData => {
 *         gaussianSplatLoader.load({ fileData, sceneModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 console.error(`Error loading .splat -> ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching .splat file -> ${err}`);
 *     });
 * ```
 *
 * Exporting that `SceneModel`'s splats back to a `.splat` file and triggering a
 * browser download:
 *
 * ```ts
 * import { GaussianSplatExporter } from "@xeokit/sdk/formats/gaussiansplat";
 *
 * const fileData = await new GaussianSplatExporter().write({ sceneModel });
 *
 * const url = URL.createObjectURL(new Blob([fileData], { type: "application/octet-stream" }));
 * const a = document.createElement("a");
 * a.href = url;
 * a.download = "scene.splat";
 * a.click();
 * URL.revokeObjectURL(url);
 * ```
 *
 * @module gaussiansplat
 * @document ./README.md
 */


export * from "./GaussianSplatLoader";
export * from "./GaussianSplatExporter";
