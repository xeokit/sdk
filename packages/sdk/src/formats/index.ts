/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
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
 * models in a variety of 3D, BIM, and point cloud formats.
 *
 * <br>
 *
 * ## Supported Formats
 *
 * The following formats are supported:
 *
 * - {@link gltf} – glTF and GLB
 * - {@link ifc} – Industry Foundation Classes (IFC)
 * - {@link cityjson} – CityJSON
 * - {@link dotbim} – DotBIM
 * - {@link las} – LAS / LAZ point cloud formats
 * - {@link xkt} – xeokit XKT
 * - {@link xgf} – xeokit Geometry Format
 * - {@link obj} – Wavefront OBJ
 * - {@link mtl} – Wavefront MTL
 * - {@link rvm} – AVEVA RVM
 * - {@link scenemodel} – xeokit SceneModel
 * - {@link datamodel} – xeokit DataModel
 * - {@link metamodel} – xeokit Metadata and schema-level information (legacy support)
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
 * - {@link scenemodel} – Serialization of {@link scene!SceneModel | SceneModels}
 * - {@link datamodel} – Serialization of {@link data!DataModel | DataModels}
 * - {@link metamodel} – Serialization of metadata and schema-level information (legacy support)
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
 * - {@link ModelParser} / {@link ModelParseParams}
 * - {@link ModelEncoder} / {@link ModelEncodeParams}
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
export * as xkt from "./xkt";
export * as las from "./las";
export * as dotbim from "./dotbim";
export * as scenemodel from "./scenemodel";
export * as datamodel from "./datamodel";
export * as metamodel from "./metamodel";
export * as obj from "./obj";
export * as mtl from "./mtl";
export * as rvm from "./rvm";

export * from "./ModelEncodeParams";
export * from "./ModelEncoder";
export * from "./ModelExporter";
export * from "./ModelExporterParams";
export * from "./ModelExportParams";
export * from "./ModelLoader";
export * from "./ModelLoaderParams";
export * from "./ModelLoadOptions";
export * from "./ModelLoadParams";
export * from "./ModelParseParams";
export * from "./ModelParser";
export * from "./ModelExportOptions";
