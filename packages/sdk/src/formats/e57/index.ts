/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit E57 Importer / Exporter
 *
 * ---
 *
 * **Import and export E57 (ASTM E2807) laser-scan point clouds.**
 *
 * ---
 *
 * E57 is the open ASTM standard for exchanging 3D imaging data from laser
 * scanners — the format reality-capture and scan-to-BIM workflows run on. An
 * E57 file wraps one or more scans behind three layers: a paged binary
 * container with per-page CRC-32C checksums, an XML header describing each
 * scan, and bit-packed `CompressedVector` point data.
 *
 * The xeokit SDK imports and exports E57 point clouds as first-class
 * {@link model!scene.SceneModel | SceneModel} content: each scan loads as a
 * {@link base!constants.PointsPrimitive | point} geometry that streams,
 * transforms, picks and renders like any other model, and writes back out to a
 * valid `.e57`.
 *
 * ### Importing `.e57` scenes
 *
 * Use the {@link E57Loader} class to load `.e57` file data into a
 * {@link model!scene.SceneModel | SceneModel} (and, optionally, a
 * {@link model!data.DataModel | DataModel}). Each `data3D` scan becomes one
 * {@link model!scene.SceneObject | SceneObject} — placed by its pose with a
 * per-scan relative-to-centre (RTC) origin for precision — plus a matching
 * DataModel object carrying the scan's metadata.
 *
 * ### Exporting `.e57` scenes
 *
 * Use the {@link E57Exporter} class to write a
 * {@link model!scene.SceneModel | SceneModel}'s point geometry back to a valid
 * `.e57`: world-space cartesian points as `Float`/single plus optional 8-bit
 * RGB, with correct CRC-32C pages. It round-trips with the loader.
 *
 * ```ts
 * import { E57Exporter } from "@xeokit/sdk/formats/e57";
 *
 * const fileData = await new E57Exporter().write({ sceneModel });
 * // fileData is an ArrayBuffer of .e57 bytes, ready to download or re-load.
 * ```
 *
 * > **Node note:** the loader reads the XML header with `DOMParser` — native in
 * > browsers, but under Node (e.g. the xeoconvert CLI) a `DOMParser` polyfill
 * > (`@xmldom/xmldom`, `linkedom`, …) must be installed on `globalThis` first,
 * > the same requirement the 3DXML loader carries. The exporter needs no
 * > `DOMParser` (it builds XML as a string).
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
 *     class E57Loader {
 *       +format : "E57"
 *       +versions : ["*"]
 *       +load(params, options?) Promise~void~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class E57Exporter {
 *       +format : "E57"
 *       +versions : ["1.0"]
 *       +write(params, options?) Promise~ArrayBuffer~
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- E57Loader
 *     ModelExporter <|-- E57Exporter
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Open ASTM standard** — reads/writes the paged binary container
 *   (CRC-32C per page), XML header and `bitPackCodec` `CompressedVector`
 *   point data, the lingua franca of laser-scan exchange.
 * - **First-class point geometry** — scans import as
 *   {@link base!constants.PointsPrimitive | PointsPrimitive} geometry, so
 *   they stream in and out, transform and pick like any other xeokit model.
 * - **Multi-scan with poses** — one {@link model!scene.SceneObject | SceneObject}
 *   per `data3D` scan, each placed by its rigid pose (quaternion + translation)
 *   so registered scans line up; toggle, isolate or colour them individually.
 * - **RTC precision** — each scan's points are stored relative to a per-scan
 *   origin, so survey-scale (UTM) coordinates render without float jitter.
 * - **Colour & intensity** — per-point RGB when present; intensity can be
 *   mapped to grayscale on import via `intensityAsColor`.
 * - **Decimation** — `skip: N` keeps every Nth point for fast preview of
 *   dense clouds.
 * - **Round-trip export** — write a SceneModel's point geometry back to a
 *   conformant `.e57` (valid CRC-32C pages) with {@link E57Exporter}.
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
 * Loading and displaying an `.e57` scan in a {@link viewing!viewer.Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/renderers/webGL";
 * import { ModelNavigationController } from "@xeokit/sdk/viewing/navigation/model";
 * import { E57Loader } from "@xeokit/sdk/formats/e57";
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
 * view.camera.eye  = [10, 10, 10];
 * view.camera.look = [0, 0, 0];
 * view.camera.up   = [0, 0, 1];
 *
 * // Point clouds render through the points material — round, perspective-scaled
 * // points give a dense scan a solid-surface look.
 * view.pointsMaterial.pointSize = 2;
 * view.pointsMaterial.roundPoints = true;
 *
 * new ModelNavigationController(view, {});
 *
 * // E57 has no mandated up-axis — declare the scanner's source frame on the
 * // model's coordinate system (basis columns are Right, Up, Forward). Survey
 * // scans are commonly Z-up:
 * const sceneModel = scene.createModel({
 *     id: "myModel",
 *     coordinateSystem: {
 *         basis: [
 *             1, 0, 0,  // Right   (+X)
 *             0, 1, 0,  // Up      (+Y)
 *             0, 0, 1,  // Forward (+Z)
 *         ],
 *         origin: [0, 0, 0],
 *         units: "meters",
 *     },
 * }).value;
 *
 * const e57Loader = new E57Loader();
 *
 * fetch("scan.e57")
 *     .then(response => response.arrayBuffer())
 *     .then(fileData => {
 *         e57Loader.load({ fileData, sceneModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 console.error(`Error loading .e57 -> ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching .e57 file -> ${err}`);
 *     });
 * ```
 *
 * Exporting that `SceneModel`'s points back to an `.e57` file and triggering a
 * browser download:
 *
 * ```ts
 * import { E57Exporter } from "@xeokit/sdk/formats/e57";
 *
 * const fileData = await new E57Exporter().write({ sceneModel });
 *
 * const url = URL.createObjectURL(new Blob([fileData], { type: "application/octet-stream" }));
 * const a = document.createElement("a");
 * a.href = url;
 * a.download = "scan.e57";
 * a.click();
 * URL.revokeObjectURL(url);
 * ```
 *
 * @module e57
 * @document ./README.md
 */
export * from "./E57Loader";
export * from "./E57LoaderOptions";
export * from "./E57Exporter";
// `./parser` is an internal implementation detail (page/CRC layer, XML, the
// CompressedVector decoder) — used by the loader/exporter and the tests, but
// deliberately NOT part of the public API.
