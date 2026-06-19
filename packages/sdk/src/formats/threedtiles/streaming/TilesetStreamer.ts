/**
 * Camera-driven streaming for a 3D Tiles tileset. Given a {@link TileNode}
 * tree, {@link TilesetStreamer.update} selects the tiles to render for a camera
 * by screen-space error and makes the scene hold exactly that set — loading
 * newly-selected tiles into per-tile SceneModels via the shared content decoder
 * and destroying any tile that is no longer selected, so coarse and fine tiles
 * never render together. The nearest `maxLoadedTiles` are kept when a selection
 * is larger than the budget, bounding memory for tilesets too large to load
 * whole.
 *
 * The core is scene-based and driven by explicit {@link TilesetStreamer.update}
 * calls so it is testable without a renderer; {@link streamTilesetInView} wires
 * it to a View's camera for live use.
 */

import type {Scene, SceneModel} from "../../../model/scene";
import type {View} from "../../../viewing/viewer";
import type {ThreeDTilesLoadOptions} from "../ThreeDTilesLoadOptions";
import type {SubtreeAvailability} from "../implicit/parseSubtree";
import {decodeTileContent, type TileContentCtx} from "../content/decodeContent";
import {resolveUrl} from "../parseTileset";
import type {TileNode} from "./TileTree";
import {type CameraState, distanceToTile} from "./screenSpaceError";
import {selectStreaming} from "./selectStreaming";

export interface TilesetStreamerParams {
  scene: Scene;
  tree: TileNode;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  /** Pixel SSE above which a tile refines to its children. Default 16. */
  maxScreenSpaceError?: number;
  /** Cap on tiles rendered at once; when the selection exceeds it, the nearest are kept. Default 512. */
  maxLoadedTiles?: number;
  /** Max concurrent tile loads. Default 6. */
  concurrency?: number;
  dracoModule?: any;
  signal?: AbortSignal;
}

export class TilesetStreamer {
  readonly #scene: Scene;
  readonly #tree: TileNode;
  readonly #fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  readonly #maxSSE: number;
  readonly #maxLoadedTiles: number;
  readonly #concurrency: number;
  readonly #options: ThreeDTilesLoadOptions;

  readonly #loaded = new Map<string, SceneModel>();
  readonly #inFlight = new Set<string>();
  // Implicit `.subtree` availability, parsed once and reused across updates.
  readonly #subtreeCache = new Map<string, SubtreeAvailability>();
  #destroyed = false;

  constructor(params: TilesetStreamerParams) {
    this.#scene = params.scene;
    this.#tree = params.tree;
    this.#fetchArrayBuffer = params.fetchArrayBuffer || defaultFetch;
    this.#maxSSE = params.maxScreenSpaceError ?? 16;
    this.#maxLoadedTiles = params.maxLoadedTiles ?? 512;
    this.#concurrency = params.concurrency ?? 6;
    this.#options = {signal: params.signal, dracoModule: params.dracoModule};
  }

  /** Number of tiles currently loaded into the scene. */
  get loadedCount(): number {
    return this.#loaded.size;
  }

  /**
   * Re-selects the tiles to render for `camera` and makes the scene hold
   * exactly that set: loads newly-selected tiles, then destroys any loaded tile
   * that is no longer selected (so a coarse tile and the finer tiles that
   * replace it never render at once). When the selection exceeds the budget,
   * only the nearest `maxLoadedTiles` are kept. Resolves once loads settle.
   */
  async update(camera: CameraState): Promise<void> {
    if (this.#destroyed) return;

    let selected = (await selectStreaming(this.#tree, camera, {
      maxScreenSpaceError: this.#maxSSE,
      fetchArrayBuffer: this.#fetchArrayBuffer,
      resolveUrl,
      subtreeCache: this.#subtreeCache,
    })).filter(n => n.contentUri);
    if (this.#destroyed) return;
    if (selected.length > this.#maxLoadedTiles) {
      selected = selected
        .sort((a, b) => distanceToTile(camera.eye, a) - distanceToTile(camera.eye, b))
        .slice(0, this.#maxLoadedTiles);
    }
    const keep = new Set(selected.map(n => n.id));

    const toLoad = selected.filter(n => !this.#loaded.has(n.id) && !this.#inFlight.has(n.id));
    // Load the incoming tiles before unloading outgoing ones, so a replaced
    // tile stays on screen until its replacement is present (no flicker / gap).
    await this.#runPool(toLoad, node => this.#loadTile(node));
    if (this.#destroyed) return;

    for (const [id, sceneModel] of [...this.#loaded]) {
      if (!keep.has(id)) {
        sceneModel.destroy();
        this.#loaded.delete(id);
      }
    }
  }

  destroy(): void {
    this.#destroyed = true;
    for (const sceneModel of this.#loaded.values()) sceneModel.destroy();
    this.#loaded.clear();
  }

  async #loadTile(node: TileNode): Promise<void> {
    this.#inFlight.add(node.id);
    let sceneModel: SceneModel | undefined;
    try {
      const buffer = await this.#fetchArrayBuffer(resolveUrl(node.contentUri!, node.baseUri));
      if (this.#destroyed) return;
      // Globalized ids prefix each object id with the model id, so identical
      // glTF node names across tiles (each a separate SceneModel) stay unique
      // scene-wide.
      const res = this.#scene.createModel({id: `tilestream-${node.id}`, globalizedIds: true});
      if (!res.ok || !res.value) return;
      sceneModel = res.value;
      const ctx: TileContentCtx = {
        sceneModel,
        worldMatrix: node.worldMatrix,
        idPrefix: node.id,
        baseUri: node.baseUri,
        options: this.#options,
        fetchArrayBuffer: this.#fetchArrayBuffer,
        resolveUrl,
      };
      await decodeTileContent(buffer, ctx);
      if (this.#destroyed) {
        sceneModel.destroy();
        return;
      }
      this.#loaded.set(node.id, sceneModel);
    } finally {
      this.#inFlight.delete(node.id);
    }
  }

  async #runPool(items: TileNode[], worker: (item: TileNode) => Promise<void>): Promise<void> {
    const queue = items.slice();
    const runners = Array.from({length: Math.min(this.#concurrency, queue.length)}, async () => {
      while (queue.length && !this.#destroyed) {
        await worker(queue.shift()!);
      }
    });
    await Promise.all(runners);
  }
}

function defaultFetch(url: string): Promise<ArrayBuffer> {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`[TilesetStreamer] HTTP ${r.status} fetching ${url}`);
    return r.arrayBuffer();
  });
}

/**
 * Drives a {@link TilesetStreamer} from a View's camera: re-streams on every
 * camera change for that View and tears down when the View is destroyed.
 * Returns the streamer for an initial `update` and manual control.
 */
export function streamTilesetInView(
  view: View,
  tree: TileNode,
  params: Omit<TilesetStreamerParams, "scene" | "tree"> = {},
): TilesetStreamer {
  const streamer = new TilesetStreamer({scene: view.viewer.scene, tree, ...params});

  const run = (): void => {
    void streamer.update({
      eye: view.camera.eye,
      viewportHeight: view.boundary[3],
      fov: view.camera.perspectiveProjection.fov,
      viewMatrix: view.camera.viewMatrix,
      projMatrix: view.camera.projMatrix,
    });
  };
  const forThisView = (changedView: View): void => {
    if (changedView === view) run();
  };

  const events = view.viewer.events;
  const unsubscribers = [
    events.onCameraViewMatrixUpdated.subscribe((v: View) => forThisView(v)),
    events.onCameraProjMatrixUpdated.subscribe((v: View) => forThisView(v)),
    events.onViewDestroyed.subscribe((_viewer: any, destroyed: View) => {
      if (destroyed === view) {
        unsubscribers.forEach(u => u());
        streamer.destroy();
      }
    }),
  ];

  run();
  return streamer;
}
