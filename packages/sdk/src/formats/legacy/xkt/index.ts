/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;"
 *      src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Legacy XKT Importer
 *
 * ---
 *
 * **Imports xeokit's legacy XKT binary format into a SceneModel and DataModel.**
 *
 * ---
 *
 * XKT is the native binary format of xeokit v2, produced by `xeokit-convert`. It
 * has been superseded by {@link xgf | XGF} in v3, but is still imported for
 * compatibility with existing XKT assets. {@link XKTLoader} reads the geometry,
 * meshes, and objects into a {@link model!scene.SceneModel | SceneModel}, and the
 * embedded model / object metadata into a {@link model!data.DataModel | DataModel}.
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
 * - **XKT version 12 only** (the latest), in the uncompressed offset-table
 *   container emitted by current `xeokit-convert`. Older versions and the
 *   legacy zlib-deflated container are not handled.
 * - Triangle (`solid` / `surface`), line, and point primitives.
 * - Per-mesh colour and opacity; metallic / roughness, textures, and texture
 *   sets are not applied.
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {Data} from "@xeokit/sdk/model/data";
 * import {XKTLoader} from "@xeokit/sdk/formats/xkt";
 *
 * const sceneModel = new Scene().createModel({id: "myModel"}).value;
 * const dataModel = new Data().createModel({id: "myModel"}).value;
 *
 * const fileData = await (await fetch("model.xkt")).arrayBuffer();
 * await new XKTLoader().load({fileData, sceneModel, dataModel});
 *
 * sceneModel.build();
 * dataModel.build();
 * ```
 *
 * The loader's `fileDataType` is `"arraybuffer"`, so read the `.xkt` as an
 * `ArrayBuffer` first.
 *
 * @module xkt
 */
export * from "./XKTLoader";
