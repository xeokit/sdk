/**
 * Parser for a 3D Tiles `tileset.json`. Traverses the tile tree, composes each
 * tile's world transform, and loads the selected tiles' content into the target
 * SceneModel (and Batch-Table metadata into the DataModel).
 *
 * This is a static one-shot import: the whole selected tile set is loaded in a
 * single pass with no camera-driven, screen-space-error streaming. Tile content
 * files are fetched relative to {@link ModelLoadOptions.baseUri}.
 *
 * Coverage: explicit tile hierarchies and implicit tiling (subtree files);
 * external tileset content (`*.json`); b3dm, pnts, i3dm, cmpt, and bare
 * glTF/GLB content; and 1.1 tileset-level metadata. Per-feature glTF
 * `EXT_structural_metadata` is not yet handled.
 */

import {createMat4Float64, type Mat4, mulMat4} from "../../base/math/matrix";
import {yieldToHost} from "../../base/utils";
import type {ModelLoadParams} from "../ModelLoadParams";
import type {ThreeDTilesLoadOptions} from "./ThreeDTilesLoadOptions";
import {decodeTileContent, type TileContentCtx} from "./content/decodeContent";
import {traverseImplicit} from "./implicit/traverseImplicit";
import {applyTileMetadata, applyTilesetMetadata} from "./tilesetMetadata";

const IDENTITY: Mat4 = createMat4Float64([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function defaultFetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  return fetch(url).then(response => {
    if (!response.ok) throw new Error(`[ThreeDTilesLoader] HTTP ${response.status} fetching ${url}`);
    return response.arrayBuffer();
  });
}

export async function parseTileset(params: ModelLoadParams, options: ThreeDTilesLoadOptions = {}): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  if (!sceneModel) return;

  const tileset = fileData;
  if (!tileset || !tileset.root) {
    throw new Error("[ThreeDTilesLoader] tileset.json has no root tile");
  }

  const fetchArrayBuffer = options.fetchArrayBuffer || defaultFetchArrayBuffer;
  const signal = options.signal;
  let nextId = 0;

  let rootDataObjectId: string | undefined;
  let groupObjectIds: string[] = [];
  let metaIndex = 0;
  if (dataModel) {
    const roots = applyTilesetMetadata(dataModel, tileset);
    rootDataObjectId = roots.rootDataObjectId;
    groupObjectIds = roots.groupObjectIds;
  }

  async function loadContentUri(uri: string, baseUri: string | undefined, worldMatrix: Mat4): Promise<void> {
    const url = resolveUrl(uri, baseUri);
    const buffer = await fetchArrayBuffer(url);

    if (uri.split("?")[0].toLowerCase().endsWith(".json")) {
      const sub = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer)));
      if (sub && sub.root) {
        await traverse(sub.root, worldMatrix, 0, "REPLACE", dirOf(url));
      }
      return;
    }

    const ctx: TileContentCtx = {
      sceneModel,
      dataModel,
      worldMatrix,
      idPrefix: `tile-${nextId++}`,
      baseUri: dirOf(url),
      options,
      fetchArrayBuffer,
      resolveUrl,
      rootDataObjectId,
    };
    await decodeTileContent(buffer, ctx);
  }

  async function traverse(
    tile: any,
    parentWorld: Mat4,
    depth: number,
    inheritedRefine: string,
    baseUri: string | undefined,
  ): Promise<void> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const world = tile.transform
      ? mulMat4(createMat4Float64(parentWorld), createMat4Float64(tile.transform), createMat4Float64())
      : parentWorld;
    const refine = (tile.refine || inheritedRefine || "REPLACE").toUpperCase();

    if (dataModel && rootDataObjectId) {
      applyTileMetadata(dataModel, tile, rootDataObjectId, groupObjectIds, metaIndex++);
    }

    if (tile.implicitTiling) {
      await traverseImplicit({
        implicitTiling: tile.implicitTiling,
        contentTemplate: tile.content && (tile.content.uri || tile.content.url),
        worldMatrix: world,
        refine,
        baseUri,
        maxDepth: options.maxDepth,
        signal,
        fetchArrayBuffer,
        resolveUrl,
        loadContent: loadContentUri,
      });
      return;
    }

    const children: any[] = tile.children || [];
    const hasChildren = children.length > 0;

    const stop =
      (options.maxDepth != null && depth >= options.maxDepth) ||
      (options.maxGeometricError != null && typeof tile.geometricError === "number" &&
        tile.geometricError <= options.maxGeometricError);

    const loadHere = refine === "ADD" || !hasChildren || stop;
    const content = tile.content;
    const uri = content && (content.uri || content.url);
    if (loadHere && uri) {
      await loadContentUri(uri, baseUri, world);
      await yieldToHost(signal);
    }

    if (hasChildren && !stop) {
      for (let i = 0; i < children.length; i++) {
        await traverse(children[i], world, depth + 1, refine, baseUri);
      }
    }
  }

  await traverse(tileset.root, IDENTITY, 0, "REPLACE", options.baseUri);
}

function dirOf(url: string): string {
  const i = url.lastIndexOf("/");
  return i >= 0 ? url.slice(0, i + 1) : url;
}

/**
 * Resolves a tile content URI against the tileset's base. Absolute URIs pass
 * through; relative URIs resolve via the URL constructor when the base is
 * absolute, falling back to a path join when the base is itself relative (the
 * URL constructor rejects a relative base, but a joined relative path still
 * resolves correctly against the page when fetched).
 */
export function resolveUrl(uri: string, baseUri: string | undefined): string {
  if (!baseUri) return uri;
  if (/^([a-z]+:)?\/\//i.test(uri) || uri.startsWith("/")) return uri;
  try {
    return new URL(uri, baseUri).toString();
  } catch {
    return baseUri.endsWith("/") ? baseUri + uri : `${baseUri}/${uri}`;
  }
}
