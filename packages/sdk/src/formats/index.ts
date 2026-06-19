/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Model Formats
 *
 * ---
 *
 * ***Import, export, and conversion support for multiple 3D and BIM file formats***
 *
 * ---
 *
 * ## Overview
 *
 * This module allows applications to load, parse, encode, and export
 * models in a variety of 3D, BIM, and point cloud formats. Every
 * format ships behind a uniform {@link ModelLoader} /
 * {@link ModelExporter} interface so tooling and applications can
 * work with multiple formats through one API.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class ModelLoader {
 *       <<abstract>>
 *       +format         : string
 *       +versions       : string[]
 *       +fileDataType   : string
 *       +load(params, options?) Promise~void~
 *     }
 *     class ModelExporter {
 *       <<abstract>>
 *       +format         : string
 *       +versions       : string[]
 *       +fileDataType   : string
 *       +write(params, options?) Promise~fileData~
 *     }
 *     class GeometryFormats {
 *       gltf / ifc / dotbim / las / xgf
 *       cityjson / obj / mtl
 *       fbx / usdz / dwg / dxf / pdf / svg / fds
 *     }
 *     class XeokitNativeFormats {
 *       scenemodel / datamodel / metamodel
 *     }
 *     ModelLoader <|-- GeometryFormats
 *     ModelExporter <|-- GeometryFormats
 *     ModelLoader <|-- XeokitNativeFormats
 *     ModelExporter <|-- XeokitNativeFormats
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Uniform loader / exporter interface** — every format
 *   subclasses {@link ModelLoader} or {@link ModelExporter} so
 *   callers can swap formats without changing call shape.
 * - **Multi-version per format** — several formats (XGF, glTF)
 *   ship multiple readers / writers under one class; `version`
 *   selects which one to use, defaulting to the latest.
 * - **Cooperative yields** — every loader / exporter honours the
 *   {@link base!utils.yieldToHost | yieldToHost} interval so very
 *   large files don't block the host's UI thread.
 * - **Progress reporting** — `options.onProgress` fires from inside
 *   loader / exporter hot loops at ~60 Hz; pair with
 *   {@link base!core.SDKProgress | SDKProgress} for typed updates.
 * - **AbortSignal cancellation** — loaders and exporters check
 *   `options.signal.aborted` at every yield and reject with
 *   `DOMException("Aborted", "AbortError")` when the caller cancels.
 * - **Browser-side I/O** — file fetches go through
 *   {@link base!io.BrowserFileIO | BrowserFileIO}, which wraps the
 *   `fetch` API.
 *
 * <br>
 *
 * ## Supported Formats
 *
 * The following formats are supported:
 *
 * - {@link formats!gltf | gltf} – glTF and GLB
 * - {@link formats!ifc | ifc} – Industry Foundation Classes (IFC)
 * - {@link formats!cityjson | cityjson} – CityJSON
 * - {@link formats!threedtiles | threedtiles} – 3D Tiles
 * - {@link formats!dotbim | dotbim} – dotbim
 * - {@link formats!las | las} – LAS / LAZ point cloud formats
 * - {@link formats!fbx | fbx} – Autodesk FBX (binary)
 * - {@link formats!usdz | usdz} – Pixar USDZ
 * - {@link formats!obj | obj} – Wavefront OBJ
 * - {@link formats!mtl | mtl} – Wavefront MTL
 * - {@link formats!dwg | dwg} – AutoCAD DWG
 * - {@link formats!dxf | dxf} – AutoCAD DXF
 * - {@link formats!pdf | pdf} – PDF
 * - {@link formats!svg | svg} – SVG
 * - {@link formats!fds | fds} – Fire Dynamics Simulator (FDS)
 * - {@link formats!xgf | xgf} – xeokit Geometry Format
 * - {@link formats!scenemodel | scenemodel} – xeokit SceneModel
 * - {@link formats!datamodel | datamodel} – xeokit DataModel
 * - {@link formats!metamodel | metamodel} – xeokit metadata / schema (legacy support)
 * - {@link formats!xkt | xkt} – xeokit v2 XKT binary (legacy support)
 *
 * Each format's namespace typically provides one or more of the following:
 *
 * - Loaders for importing external files
 * - Exporters for writing files from xeokit models
 * - Parsers and encoders for converting intermediate representations
 *
 * <br>
 *
 * ## SceneModel and DataModel Formats
 *
 * In addition to external file formats, this module includes support for xeokit's native
 * JSON-based serialization formats:
 *
 * - {@link formats!scenemodel | scenemodel} – Serialization of {@link model!scene.SceneModel | SceneModels}
 * - {@link formats!datamodel | datamodel} – Serialization of {@link model!data.DataModel | DataModels}
 * - {@link formats!metamodel | metamodel} – Serialization of metadata and schema-level information (legacy support)
 *
 * These formats are typically used for persistence, interchange between applications,
 * or pre-processing workflows.
 *
 * <br>
 *
 * ## Generic Import and Export APIs
 *
 * The module defines generic base types that are shared across format implementations:
 *
 * - {@link ModelLoader} / {@link ModelLoaderParams}
 * - {@link ModelExporter} / {@link ModelExporterParams}
 *
 * These abstractions allow tooling and applications to work with multiple formats
 * through a consistent API, independent of the underlying file type.
 *
 * @module formats
 */
export * as gltf from "./gltf";
export * as cityjson from "./cityjson";
export * as ifc from "./ifc";
export * as xgf from "./xgf";
export * as las from "./las";
export * as dotbim from "./dotbim";
export * as scenemodel from "./scenemodel";
export * as datamodel from "./datamodel";
export * as gaussiansplat from "./gaussiansplat";
export * as metamodel from "./legacy/metamodel";
export * as xkt from "./legacy/xkt";
export * as obj from "./obj";
export * as mtl from "./mtl";
export * as fbx from "./fbx";
export * as usdz from "./usdz";
export * as pdf from "./pdf";
export * as svg from "./svg";
export * as dwg from "./dwg";
export * as dxf from "./dxf";
export * as fds from "./fds";
export * as threedxml from "./threedxml";
export * as threedtiles from "./threedtiles";

export * from "./ModelExporter";
export * from "./ModelExporterParams";
export * from "./ModelExportParams";
export * from "./LoaderProgress";
export * from "./ModelLoader";
export * from "./ModelLoaderParams";
export * from "./ModelLoadOptions";
export * from "./ModelLoadParams";
export * from "./ModelExportOptions";
