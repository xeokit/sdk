/**
 * # xeokit XGF Stream Format
 *
 * XGF Stream is the chunked streaming companion to {@link formats!xgf | XGF}.
 * It stores a model as a streaming index plus multiple XGF v2 chunks.
 * Asset-library chunks create reusable geometry, materials and textures;
 * references-only chunks create scene content that binds to those assets by
 * stable ID.
 *
 * Use {@link XGFStreamExporter} to write a chunked stream package,
 * {@link XGFStreamingLoader} to load chunks manually, and
 * {@link XGFViewStreamController} to prioritize chunk loading from the active
 * view volume.
 *
 * ## Storage Shape
 *
 * A stream package is normally written as:
 *
 * ```text
 * model/
 * +- index.runtime.json
 * +- index.json
 * +- chunks/
 *    +- assets-shared.xgf
 *    +- assets-000.xgf
 *    +- chunk-00000-x000-y000-z000.xgf
 *    +- chunk-00001-x000-y000-z001.xgf
 * ```
 *
 * `index.json` is the human-readable stream index. `index.runtime.json` is the
 * compact runtime form used by examples and production viewers that want less
 * JSON parsing and transfer overhead. Chunk files are still normal XGF v2
 * payloads.
 *
 * ## Exporting a Stream
 *
 * Use {@link XGFStreamExporter} when you have an in-memory
 * {@link model!scene.SceneModel | SceneModel} and want a complete file map.
 * Grid partitioning is the default because camera-prioritized streaming needs
 * chunk bounds that can be tested against the view frustum. Use
 * `partition: "object-order"` only when deterministic source-order chunking is
 * more important than spatial locality.
 *
 * ```ts
 * import {XGFStreamExporter} from "@xeokit/sdk/formats/xgfstream";
 *
 * const result = await new XGFStreamExporter().write(
 *   {sceneModel},
 *   {
 *     chunkSize: 500,
 *     chunkMetric: "objects",
 *     assetLibraryChunkSize: 16,
 *     sharedAssetMinLibraryUses: 2,
 *     runtimeIndex: "index.runtime.json"
 *   }
 * );
 *
 * // result.fileData is an XGFStreamFileMap:
 * // {
 * //   files: {"index.json": "...", "chunks/chunk-00000.xgf": ArrayBuffer, ...},
 * //   index,
 * //   manifests
 * // }
 * ```
 *
 * When using `xeoconvert`, select an `xgfstream` pipeline or an output file
 * with the `.xgfstream` extension. The converter writes the index files plus
 * the chunk directory rather than one monolithic binary.
 *
 * ## Reading a Runtime Index
 *
 * Runtime indexes are decoded with {@link readXGFStreamingRuntimeIndex}. The
 * function returns an `SDKResult`; handled parse/validation failures are
 * reported without throwing.
 *
 * ```ts
 * import {readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
 *
 * const runtimeJSON = await (await fetch("./model/index.runtime.json")).json();
 * const indexResult = readXGFStreamingRuntimeIndex(runtimeJSON);
 *
 * if (!indexResult.ok) {
 *   scene.logError(indexResult);
 *   return;
 * }
 *
 * const index = indexResult.value;
 * ```
 *
 * ## Manual Chunk Loading
 *
 * Use {@link XGFStreamingLoader} when application code decides exactly which
 * chunks to load. The loader resolves dependency chunks, fetches missing XGF
 * bytes through `getFileData`, and applies chunks to the target
 * `SceneModel`.
 *
 * ```ts
 * import {
 *   createXGFStreamingIndexLookup,
 *   XGFStreamingLoader
 * } from "@xeokit/sdk/formats/xgfstream";
 *
 * const lookup = createXGFStreamingIndexLookup(index);
 * const loader = new XGFStreamingLoader();
 * const chunk = lookup.getChunkById("chunk-00042");
 *
 * if (chunk) {
 *   await loader.loadChunk(
 *     {
 *       manifest: chunk,
 *       sceneModel,
 *       dataModel
 *     },
 *     {
 *       manifests: lookup,
 *       baseUri: "./model/",
 *       getFileData: async (manifest) =>
 *         (await fetch(`./model/${manifest.uri}`)).arrayBuffer(),
 *       onChunkLoaded: (manifest) => {
 *         console.log(`loaded ${manifest.id}`);
 *       }
 *     }
 *   );
 * }
 * ```
 *
 * The loader also supports `fileDataByChunkId` and `fileDataByUri` for callers
 * that already have chunk bytes in memory.
 *
 * ## View-Prioritized Streaming
 *
 * Use {@link XGFViewStreamController} when chunk loading should follow the
 * current view. It tests chunk AABBs against the camera frustum, optionally
 * drops chunks below `minProjectedChunkSizePixels`, loads visible chunks first,
 * then orders remaining candidates by distance to the camera look point. Set
 * `chunkPriorityTarget: "eye"` to prioritize from the camera position instead.
 * Already-loaded chunks are retained.
 *
 * ```ts
 * import {XGFViewStreamController} from "@xeokit/sdk/formats/xgfstream";
 *
 * const controller = new XGFViewStreamController({
 *   index,
 *   sceneModel,
 *   view,
 *   frustumOnly: true,
 *   minProjectedChunkSizePixels: 4,
 *   batchSize: 8,
 *   fetchConcurrency: 8,
 *   loadOptions: {
 *     baseUri: "./model/",
 *     getFileData: async (manifest) =>
 *       (await fetch(`./model/${manifest.uri}`)).arrayBuffer()
 *   },
 *   onProgress: ({queued, loaded}) => {
 *     progressBar.value = queued > 0 ? loaded / queued : 1;
 *   },
 *   onError: (error) => {
 *     console.error(error);
 *   }
 * });
 *
 * controller.schedule("initial");
 * ```
 *
 * Call `schedule()` again when the relevant camera/frustum changes. Use
 * `prefetchInitial()` to warm a small set of high-priority chunks before the
 * first scheduled pass.
 *
 * ## Relationship to XGF
 *
 * XGF Stream is not a generic streaming wrapper for arbitrary formats. Its
 * chunks are XGF v2 payloads, and its asset reuse depends on XGF's
 * `assetLibrary` and `referencesOnly` roles. The reusable scheduling ideas
 * are generic, but this format's file contract is intentionally XGF-specific.
 *
 * @module xgfstream
 * @document ./README.md
 */
export * from "./XGFStreamExporter";
export * from "./XGFStreamingLoader";
export * from "./XGFManifest";
export * from "./export/XGFAssetMode";
export * from "./chunk/XGFChunkRole";
export * from "./chunk/XGFChunkDependency";
export * from "./chunk/XGFChunkManifest";
export * from "./chunk/XGFChunkLoadStats";
export * from "./manifest/XGFManifestOptions";
export * from "./chunk/XGFChunkLoadParams";
export * from "./chunk/XGFChunkLoadOptions";
export * from "./chunk/XGFChunksLoadParams";
export * from "./chunk/XGFChunksLoadOptions";
export * from "./chunk/XGFChunkUnloadParams";
export * from "./view/XGFViewStreamController";
export * from "./view/XGFViewStreamControllerParams";
export * from "./manifest/writeXGFChunkManifest";
export * from "./manifest/readXGFChunkManifest";
export * from "./index/XGFStreamingIndex";
export * from "./index/writeXGFStreamingIndex";
export * from "./index/readXGFStreamingIndex";
export * from "./index/XGFStreamingRuntimeIndex";
export * from "./index/writeXGFStreamingRuntimeIndex";
export * from "./index/readXGFStreamingRuntimeIndex";
export * from "./index/XGFStreamingIndexLookup";
export * from "./index/createXGFStreamingIndexLookup";
