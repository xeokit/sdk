/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Legacy XKT Importer / Exporter
 *
 * ---
 *
 * **Imports and exports xeokit's legacy XKT binary format.**
 *
 * ---
 *
 * XKT is the native binary format of xeokit v2, produced by `xeokit-convert`. It
 * has been superseded by {@link xgf | XGF} in v3, but is still supported for
 * compatibility with existing XKT assets. {@link XKTLoader} reads the geometry,
 * meshes, and objects into a {@link model!scene.SceneModel | SceneModel}, and the
 * embedded model / object metadata into a {@link model!data.DataModel | DataModel};
 * {@link XKTExporter} writes a SceneModel + DataModel back out as XKT.
 *
 * An XKT file pools all geometry into shared arrays of 16-bit quantised
 * positions, indices, and per-mesh material attributes, grouped into spatial
 * tiles. Geometry used by a single mesh is baked into its tile's coordinate
 * frame; geometry shared by several meshes is instanced. The loader reconstructs
 * this into SceneModel geometries, meshes (placed with a per-tile RTC `origin`
 * for full precision), and objects, and maps the metadata `metaObjects` into a
 * DataModel object tree with aggregation relationships.
 *
 * ## Scope
 *
 * - **Loading: XKT versions 7 through 12.** Versions 7-10 use the legacy
 *   zlib-deflated container; versions 11-12 use the uncompressed offset-table
 *   container emitted by current `xeokit-convert`. Versions 1-6 are not handled.
 * - Triangle (`solid` / `surface`), line, and point primitives.
 * - Per-mesh colour and opacity; metallic / roughness, textures, texture sets,
 *   and UVs are not applied.
 * - Metadata is mapped to a DataModel from version 8 onwards (v8 stores it as
 *   parallel arrays; v9+ as a JSON document); versions 7 and earlier carried
 *   metadata in a separate file.
 * - **Export writes XKT version 12 only:** a single tile and one geometry per
 *   mesh (geometry is not re-instanced) with no textures.
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {Data} from "@xeokit/sdk/model/data";
 * import {XKTLoader, XKTExporter} from "@xeokit/sdk/formats/xkt";
 *
 * const sceneModel = new Scene().createModel({id: "myModel"}).value;
 * const dataModel = new Data().createModel({id: "myModel"}).value;
 *
 * const fileData = await (await fetch("model.xkt")).arrayBuffer();
 * await new XKTLoader().load({fileData, sceneModel, dataModel});
 *
 * // …and back out:
 * const xkt = await new XKTExporter().write({sceneModel, dataModel}); // ArrayBuffer
 * ```
 *
 * The loader's / exporter's `fileDataType` is `"arraybuffer"`, so read the
 * `.xkt` as an `ArrayBuffer` first, and the exporter resolves to one.
 *
 * @module xkt
 * @document ./README.md
 */
export * from "./XKTLoader";
export * from "./XKTExporter";
