/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px; height:130px" src="../../assets/3D-Cart.svg"/>
 *
 * # 3D Tiles
 *
 * Imports an OGC / Cesium [3D Tiles](https://github.com/CesiumGS/3d-tiles)
 * `tileset.json` and its content into a {@link model!scene.SceneModel | SceneModel},
 * and per-feature / per-tile metadata into a {@link model!data.DataModel | DataModel}.
 *
 * {@link ThreeDTilesLoader} is a static one-shot import: the tile tree is
 * traversed once and the selected tiles are loaded in a single pass (leaf tiles
 * by default; `maxDepth` / `maxGeometricError` load coarser detail). Content
 * covers `b3dm`, `pnts`, `i3dm`, `cmpt`, and bare glTF / GLB, plus external
 * tilesets and implicit tiling; each tile's world transform is baked into the
 * per-mesh matrices, so georeferenced (ECEF) tilesets keep full precision.
 *
 * For tilesets too large to load whole, {@link TilesetStreamer} (and the
 * {@link streamTilesetInView} helper) stream the visible tiles as the camera
 * moves: each camera change selects tiles from an in-memory
 * {@link buildTileTree | tile tree} by screen-space error, frustum-culls those
 * outside the view, and loads / unloads per-tile SceneModels so the scene holds
 * exactly the visible set. Implicit tilesets stream too — a tile with
 * `implicitTiling` expands lazily, fetching `.subtree` files only as the camera
 * descends. Streaming covers explicit and implicit (QUADTREE / OCTREE) trees, a
 * perspective camera, and `box` / `sphere` / `region` bounding volumes (a
 * geodetic `region` becomes an ECEF sphere; `box` for implicit).
 *
 * A glTF mesh whose `EXT_mesh_features` feature ids are a per-vertex attribute
 * bound to an `EXT_structural_metadata` property table is split into one
 * SceneObject per feature, each sharing its id with the feature's DataObject so
 * a picked feature resolves to its metadata. KTX2 / Basis textures are not
 * uploaded (no compressed-texture path), and feature id textures are not split.
 * See the linked format guide for the full pipeline, content decode, and limitations.
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/scene";
 * import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({id: "city"}).value;
 *
 * const tileset = await (await fetch("./city/tileset.json")).json();
 * await new ThreeDTilesLoader().load(
 *   {fileData: tileset, sceneModel},
 *   {baseUri: "./city/"}   // directory the tileset and its content live in
 * );
 *
 * sceneModel.build();
 * ```
 *
 * @module threedtiles
 * @document ./README.md
 */
export {ThreeDTilesLoader} from "./ThreeDTilesLoader";
export type {ThreeDTilesLoadOptions} from "./ThreeDTilesLoadOptions";
export {
  buildTileTree,
  type TileNode,
  type ImplicitSpec,
  type CameraState,
  selectTiles,
  selectStreaming,
  type SelectStreamingOptions,
  screenSpaceError,
  distanceToTile,
  TilesetStreamer,
  type TilesetStreamerParams,
  streamTilesetInView,
} from "./streaming";
