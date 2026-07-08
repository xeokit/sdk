import {Scene, SceneModel, type SceneModelStats, type CoordinateSystemParams} from "../model/scene";
import {Data, DataModel, type DataModelStats} from "../model/data";
import {View, Viewer, ViewObject, type ViewParams} from "../viewing/viewer";
import {type MemoryConfigs, type MemoryUsage, WebGLRenderer} from "../viewing/webGLRenderer";
import {WebGPURenderer, type WebGPURendererParams} from "../viewing/webGPURenderer";
import type {RenderStats} from "../viewing/webGLRenderer/internal/inspectors";
import type {Renderer} from "../viewing/renderer";
import {EventsLogger, getGlobalTaskRunner, sdkProgress, SDKErrorType, type SDKResult, SDKTask} from "../base/core";
import type {ImportProvenance} from "./panels/modelsPanel/ImportProvenance";
import {StudioEvents} from "./StudioEvents";
// IssuesPanel is the one panel Studio still touches directly — init()
// pre-mounts it hidden (`visible: false`) so it begins capturing
// onError emissions before the user opens it. The registry-provided
// `issuesPanel` entry always reveals (visible: true), so the init
// case stays direct.
import {IssuesPanel} from "./panels/issuesPanel/IssuesPanel";
import {InfoPanel, type InfoPanelParams} from "./panels/infoPanel";
import {LoaderProgressDialog} from "./dialogs/LoaderProgressDialog";
import {createUUID} from "../base/utils";
import {
  CanvasContextMenu,
  type CanvasContextMenuContext,
  ViewObjectContextMenu,
  type ViewObjectContextMenuContext
} from "./contextMenus";
import {
  createDefaultLoaderRegistry,
  DefaultModelLocator,
  type FormatFetchKind,
  type LoaderRegistry,
  type ModelLocator,
} from "./loading";
import {
  PanelRegistry,
  registerBuiltinPanels,
} from "./panels";
import {LoadingSpinner} from "./LoadingSpinner";
import {ViewManager, type ViewRecord} from "./viewManager";
import {PickingService} from "./picking";
import type {TransformControlsMode, TransformControlsTarget} from "../viewing/transformControls";
import {AdaptiveQuality} from "../viewing/adaptiveQuality";
import type {Vec3} from "../base/math/vector";
import {encodeRadianceHDR, paintSunSkyHDR} from "../model/procgen/paintEnvironments";
import {getScenePhysics, type ScenePhysics} from "../simulation/physics";

const taskRunner = getGlobalTaskRunner();

/**
 * Tiny HTML escaper used by {@link Studio.openInfoPanelFromMeta}
 * — example metadata `description` strings are author-trusted but
 * may contain stray angle brackets that the InfoPanel would
 * otherwise interpret as markup. Output is wrapped in a `<p>` by
 * the caller, so no need to handle newlines here.
 */
function escapeHtmlForInfoPanel(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Configuration options for the Studio.
 */
export type StudioRendererBackend = "webgl" | "webgpu";

export interface StudioConfig {

  /**
   * Base directory for loading models, relative to the HTML page. Defaults to `"../../models"`.
   */
  modelsDir?: string;

  /**
   * Renderer backend to instantiate. Defaults to `"webgl"`.
   *
   * Use `"webgpu"` to create a {@link viewing!webGPURenderer.WebGPURenderer | WebGPURenderer}
   * instead of the default {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}.
   */
  renderer?: StudioRendererBackend;

  /**
   * WebGPU renderer options used when {@link renderer} is `"webgpu"`.
   *
   * `viewer` is ignored because Studio owns Viewer creation and attachment.
   */
  webGPU?: Omit<WebGPURendererParams, "viewer">;

  /**
   * The maximum number of views to create. This is used to configure the WebGLRenderer's memory management,
   * and also limits the number of views that can be created via `createView()`. Defaults to `4`.
   */
  maxViews?: number;

  /**
   * Overrides for the WebGLRenderer's GPU memory budget (merged over Studio's
   * defaults). Raise `maxBatchVertices` / `maxBatchIndices` / `maxBatchPrims`
   * when loading models or 3D Tiles whose individual meshes exceed the default
   * per-batch capacity (the default `maxBatchVertices` is 500000).
   */
  memoryConfigs?: Partial<MemoryConfigs>;


  makeComponents?: boolean;

  /**
   * Whether to set up event loggers for the Scene, Data, Viewer, and renderer. Defaults to `false`.
   * These loggers will log their output to the console, and do slow down the demo, so they should only
   * be enabled when needed for debugging.
   */
  logging?: boolean;

  /**
   * When `true`, exposes engineer-only entries in the context
   * menus (currently a Debug ▶ submenu with the WebGL
   * context-loss simulator). Default `false` — production demos
   * keep the interface free of debug affordances.
   */
  debug?: boolean;

  /**
   * Optional registry of model-format loaders. When omitted, Studio
   * uses {@link createDefaultLoaderRegistry} which registers every
   * built-in format. Pass a custom registry to load only a subset
   * (smaller bundle), to add proprietary formats, or to substitute
   * loader implementations in tests.
   */
  loaders?: LoaderRegistry;

  /**
   * Optional resolver for the default URL of a model when callers
   * pass `{modelId, format}` without an explicit `src`. When omitted,
   * Studio uses {@link DefaultModelLocator} with the convention
   * `{modelsDir}/{modelId}/{format}/model.{ext}`. Inject a custom
   * locator for deployments that arrange files differently.
   */
  locator?: ModelLocator;
}

/**
 * Helper class to set up a basic 3D demo with a Scene, Data, Viewer,
 * renderer, and View.
 *
 * See {@link studio | @xeokit/sdk/demo} for usage.
 */
export class Studio {

  /**
   * Base directory for loading models, relative to the HTML page.
   */
  public modelsDir: string = "../../models";

  /**
   * The Scene created by the Studio. Holds all 3D objects.
   */
  public scene: Scene;

  /**
   * The Data created by the Studio. Holds all data models.
   */
  public data: Data;

  /**
   * The Viewer created by the Studio.
   */
  public viewer: Viewer;

  /**
   * The renderer created by the Studio.
   */
  public renderer: Renderer;

  /**
   * Owns the lifecycle of every View created through Studio — the
   * `views` map (records of `view`, `cameraFlight`, `viewController`),
   * auto-canvas layout, and floating ViewPanels for `floating: true`.
   * Read access: `studio.viewManager.views[id].cameraFlight`.
   * Create / destroy: `studio.viewManager.createView(...)` /
   * `studio.viewManager.destroyView(view)`.
   */
  public viewManager: ViewManager;

  /**
   * Owns the unified pick strategy and the BVH-backed
   * {@link SceneCollisionIndex}. Lazy-built — demos that never pick
   * pay for neither.
   * Direct picks: `studio.picking.picker.pick({...})`.
   * AABB queries: `studio.picking.collisionIndex.getSceneAABB()`.
   * ViewController adapter: `studio.picking.pickForViewController(view, params)`.
   */
  public picking: PickingService;

  /**
   * Registry of model-format loaders consulted by {@link loadModel}.
   * Populated from {@link StudioConfig.loaders} or {@link createDefaultLoaderRegistry}.
   */
  public loaders: LoaderRegistry;

  /**
   * Resolves the default URL for a `(modelId, format)` pair when
   * {@link loadModel} is called without an explicit `src`. Populated
   * from {@link StudioConfig.locator} or {@link DefaultModelLocator}.
   */
  public locator: ModelLocator;

  /**
   * Single dispatch point for opening, hiding, and toggling every
   * built-in panel and tool — `studio.panels.open("modelsPanel")`,
   * `studio.panels.toggle("navCube", {view})`, etc. — keyed by panel
   * id instead of a dedicated method per panel.
   *
   * Register custom panels with `studio.panels.register("myId", ...)`
   * and augment {@link PanelMap} from your own module so the call
   * sites stay typed.
   */
  public readonly panels: PanelRegistry;

  /**
   * Per-Studio event hub — currently just `onError` / `onWarning`.
   * Mirrors the `*.events` shape on Scene, Data, Viewer, and
   * WebGLRenderer; the {@link panels!issuesPanel.IssuesPanel | IssuesPanel}
   * subscribes here alongside those four to report Studio-side
   * failures in the same list.
   */
  public readonly events: StudioEvents = new StudioEvents();

  private makeComponents: boolean = true;
  private debug: boolean = false;

  /**
   * Config passed to the constructor, retained so {@link init} can merge it
   * with any config passed to `init()` — settings apply from either entry point.
   */
  private _config: StudioConfig = {};

  private _viewObjectContextMenu: ViewObjectContextMenu;

  private _canvasContextMenu: CanvasContextMenu;

  private _loadingSpinner: LoadingSpinner;

  // Lazy-initialised by demolishModel(). Stays undefined until the
  // first call so demos that never demolish anything don't pay for
  // Rapier load + ScenePhysics setup.
  private _demolitionPhysics?: ScenePhysics;
  private _demolitionRaf: number | null = null;

  /**
   * Singleton InfoPanel managed by {@link openInfoPanel}. Each call
   * destroys the previous panel before constructing a fresh one, so
   * an example always has at most one info card on screen.
   */
  private _infoPanel: InfoPanel | null = null;

  /**
   * Statistics about the demo, available after calling `finished()`.
   */
  public stats: {
    aabb: number[];
    startTime: number;
    endTime: number;
    elapsedTime: number;
    scene: SceneModelStats;
    data: DataModelStats;
    memory: MemoryUsage;
    renderer: RenderStats;
  };

  /**
   * Creates a Studio instance.
   * @param cfg
   */
  constructor(cfg: StudioConfig = {}) {
    this._config = cfg;
    this._applyConfig(cfg);
    this.picking = new PickingService(() => this.scene, () => this.renderer);
    this.panels  = new PanelRegistry({studio: this});
    registerBuiltinPanels(this.panels);
    this.stats = {
      startTime: 0,
      endTime: 0,
      elapsedTime: 0,
      aabb: null,
      scene: null,
      data: null,
      memory: null,
      renderer: null
    };
  }

  /**
   * Applies the config fields that can be set from either the constructor or
   * {@link init}. Provided fields win; omitted ones keep their current /
   * default values. The default model locator is rebuilt from `modelsDir`
   * unless a custom locator is supplied.
   */
  private _applyConfig(cfg: StudioConfig): void {
    this.modelsDir = cfg.modelsDir ?? this.modelsDir;
    this.loaders = cfg.loaders ?? this.loaders ?? createDefaultLoaderRegistry();
    this.locator = cfg.locator ?? new DefaultModelLocator(this.modelsDir);
    this.makeComponents = cfg.makeComponents !== false;
    this.debug = cfg.debug === true;
  }

  /**
   * Create the configured renderer backend. WebGL is synchronous; WebGPU may
   * need to request an adapter/device, so Studio keeps the factory async.
   */
  private async _createRenderer(cfg: StudioConfig): Promise<SDKResult<Renderer>> {
    const backend = cfg.renderer ?? "webgl";

    if (backend === "webgpu") {
      const {viewer: _viewer, ...webGPUParams} = (cfg.webGPU ?? {}) as WebGPURendererParams;
      const result = await WebGPURenderer.create(webGPUParams);
      if (result.ok === false) {
        return result;
      }
      return {
        ok: true,
        value: result.value
      };
    }

    if (backend === "webgl") {
      return {
        ok: true,
        value: new WebGLRenderer({
          debugging: this.debug,
          memoryConfigs: {
            tileSize: 200,
            maxTiles: 4096,
            maxBatches: 1000,
            maxBatchVertices: 500000,
            maxBatchIndices: 800000,
            maxBatchGeometries: 60000,
            maxBatchMeshes: 20000,
            maxBatchPrims: 400000,
            ...(cfg.memoryConfigs || {}),
            maxViews: this.viewManager.maxViews,
          }
        })
      };
    }

    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: `[Studio.init] Unsupported renderer backend '${String(backend)}'. Expected 'webgl' or 'webgpu'.`
    };
  }

  /**
   * Dispatch an error through this Studio's {@link StudioEvents.onError}
   * channel. The {@link panels!issuesPanel.IssuesPanel | IssuesPanel}
   * is the canonical subscriber — every dispatch lands as a row in
   * its log, with severity = `"error"`. Panels and host code use
   * this in place of `throw` / `console.error` so the IssuesPanel
   * is the single place to report Studio-side failures.
   *
   * Accepts either an `SDKResult<any>` (an `ok: false` outcome
   * coming back from a downstream call) or a plain message string.
   * For the string form, the dispatched payload synthesises an
   * `SDKResult<void>` shape with the supplied `type` (defaulting
   * to `SDKErrorType.InvalidOperation`).
   */
  public reportError(error: SDKResult<any> | string, type?: SDKErrorType): void {
    const payload: SDKResult<any> = typeof error === "string"
      ? {ok: false, type: type ?? SDKErrorType.InvalidOperation, error}
      : error;
    this.events.onError.dispatch(this, payload);
  }

  /**
   * Dispatch a recoverable warning through this Studio's
   * {@link StudioEvents.onWarning} channel. Same payload shape and
   * routing as {@link reportError}; the IssuesPanel reports these
   * with severity = `"warning"`.
   */
  public reportWarning(warning: SDKResult<any> | string, type?: SDKErrorType): void {
    const payload: SDKResult<any> = typeof warning === "string"
      ? {ok: false, type: type ?? SDKErrorType.InvalidOperation, error: warning}
      : warning;
    this.events.onWarning.dispatch(this, payload);
  }

  /**
   * Initializes the Studio by creating the Scene, Data, Viewer, configured
   * renderer backend, and optional initial View.
   *
   * @param cfg Configuration options for initialization.
   * @returns A promise that resolves when initialization is complete.
   */
  public async init(cfg: StudioConfig = {}): Promise<any> {

    // Merge config from the constructor and from init() (init wins), so every
    // setting applies regardless of which entry point it was passed to.
    const merged: StudioConfig = {...this._config, ...cfg};
    this._applyConfig(merged);

    this.stats.startTime = performance.now();

    if (!this.makeComponents) {
      return {};
    }

    this.scene = new Scene();
    this.data = new Data();
    this.viewer = new Viewer();

    const rendererBackend = merged.renderer ?? "webgl";

    this.viewManager = new ViewManager({
        viewer: this.viewer,
        // PickingService is constructed in Studio's constructor;
        // its lazy getters wait for scene/renderer to be set.
        pickFn: (view, pickParams) => this.picking.pickForViewController(view, pickParams),
      },
      {
        // Studio layers context-menu setup + IBL on top of the
        // bare View record the manager produces.
        onViewCreated: (view, record) => this._onViewCreated(view, record),
      },
      {
        maxViews: merged.maxViews ?? 4,
        autoElementType: rendererBackend === "webgpu" ? "canvas" : "image",
      },
    );

    const rendererResult = await this._createRenderer(merged);
    if (rendererResult.ok === false) {
      throw rendererResult.error;
    }
    this.renderer = rendererResult.value;

    const log = (eventName: string, sender: any, args: any) => {
      console.log(`[${sender.constructor.name.padEnd(14)}] ${eventName}`, args);
    };

    if (merged.logging) {
      new EventsLogger(this.scene.events, {prefix: "[Scene        ]", log});
      new EventsLogger(this.data.events, {prefix: "[Data         ]", log});
      new EventsLogger(this.viewer.events, {prefix: "[Viewer       ]", log});
      new EventsLogger(this.renderer.events, {prefix: `[${this.renderer.constructor.name}]`, log});
    }

    const onError = (_, result: SDKResult<any>) => {
      setInterval(() => {
        window.postMessage({
          type: "xeokit.Error",
          payload: result
        }, "*");
      }, 1000);
      const div = document.createElement("div");
      div.id = "Error";
      document.body.appendChild(div);
    };

    this.scene.events.onError.subscribe(onError);
    this.data.events.onError.subscribe(onError);
    this.viewer.events.onError.subscribe(onError);
    this.renderer.events.onError.subscribe(onError);

    // Pre-mount the IssuesPanel (hidden) so it begins
    // capturing onError emissions before the user opens it
    // via the context menu — and so the very first error
    // can auto-show the panel even when nothing else has
    // touched the helper. Idempotent: `getIssuesPanel`
    // returns this same instance later.
    try {
      IssuesPanel.openFor({
        viewer: this.viewer,
        scene: this.scene,
        data: this.data,
        renderer: this.renderer,
        studioEvents: this.events,
        visible: false,
      });
    } catch (e: any) {
      this.reportError(
        `[Studio.init] Failed to mount IssuesPanel: ${e?.message ?? e}`,
        SDKErrorType.InitializationFailed,
      );
    }

    this.viewer.attachScene(this.scene);
    const attachResult = this.renderer.attachViewer(this.viewer);
    if (attachResult.ok === false) {
      throw attachResult.error;
    }

    if (this.renderer instanceof WebGLRenderer) {
      const renderInspectorResult = this.renderer.getRenderInspector();
      if (renderInspectorResult.ok !== true) {
        throw renderInspectorResult.error;
      }
      const renderInspector = renderInspectorResult.value;
      renderInspector.enabled = true;
    }

    this._viewObjectContextMenu = new ViewObjectContextMenu({debug: this.debug});
    this._canvasContextMenu = new CanvasContextMenu({debug: this.debug});

    this._canvasContextMenu.on("hidden", () => {
      taskRunner.unsuspend();
    });

    this._viewObjectContextMenu.on("hidden", () => {
      taskRunner.unsuspend();
    });

    this._loadingSpinner = new LoadingSpinner({
      autoHide: true,
      autoHideDelayMs: 500
    });

    sdkProgress.addTask(); // Init

    // @ts-ignore
    window.studio = this;

    // Auto-mount the Toolbar but start it HIDDEN — the only UI
    // surface that's visible by default is the reopen pill in
    // the bottom-right rail. This keeps the canvas unobstructed
    // for embeds and screenshots while leaving the Measure
    // cluster, NavCube, Views and other tool toggles one click
    // away. Visibility default lives in `builtinPanels.ts` as
    // `visible: false` on the toolbar provider's `create`.
    try {
      this.panels.open("toolbar");
    } catch (e: any) {
      this.reportError(
        `[Studio.init] Failed to auto-mount Toolbar: ${e?.message ?? e}`,
        SDKErrorType.InitializationFailed,
      );
    }

    return {};
  }

  /**
   * Loads a model into the Scene and/or Data layers using a format-specific loader.
   *
   * This method:
   * - Resolves or creates {@link model!scene.SceneModel | SceneModel} and {@link model!data.DataModel | DataModel} instances when not provided
   * - Fetches model data from `params.src` or a default path derived from `modelId`
   * - Selects the appropriate loader based on `params.format`
   * - Delegates parsing and population to the corresponding loader implementation
   *
   * Supported formats:
   * - `"xgf"` → {@link XGFLoader} (binary)
   * - `"ifc"` → {@link IFCLoader} (binary)
   * - `"gltf"` → {@link GLTFLoader} (binary, `.glb`)
   * - `"fbx"` → {@link FBXLoader} (binary, `.fbx`)
   * - `"metamodel"` → {@link MetaModelLoader} (JSON, data-only)
   * - `"datamodel"` → {@link DataModelImporter} (JSON, data-only)
   * - `"scenemodel"` → {@link SceneModelImporter} (JSON, scene-only)
   *
   * Default source resolution:
   * If `params.src` is not provided, the source path is inferred as:
   * `../../models/{modelId}/{format}/model.{ext}`
   *
   * Model creation behavior:
   * - If `sceneModel` is not provided, a new one is created via `this.scene.createModel()`
   * - If `dataModel` is not provided, a new one is created via `this.data.createModel()`
   * - Created model IDs are derived from `modelId` when available
   *
   * @param params - Configuration for loading the model
   * @param params.src - Optional explicit source URL/path for the model file
   * @param params.modelId - Optional identifier used for default paths and generated model IDs
   * @param params.format - Model format determining which loader to use
   * @param params.dataModel - Optional existing {@link model!data.DataModel | DataModel} to populate
   * @param params.sceneModel - Optional existing {@link model!scene.SceneModel | SceneModel} to populate
   *
   * @param options - Loader-specific options passed through to the underlying loader
   *
   * @returns A promise resolving to an {@link base!core.SDKResult | SDKResult} containing the loader result
   *
   * @throws Error
   * - If model creation fails
   * - If the format is unsupported
   * - If fetching or parsing the model data fails
   */
  async loadModel(
    params: {
      src?: string;
      modelId?: string;
      format: string;
      dataModel?: DataModel;
      sceneModel?: SceneModel;
    },
    options: any
  ): Promise<SDKResult<any>> {

    let coordinateSystem: CoordinateSystemParams | undefined;
    if (!params.sceneModel && params.modelId) {
      coordinateSystem = await this._loadCoordSys(params.modelId);
    }

    const descriptor = this.loaders.get(params.format);
    if (!descriptor) {
      const err = this._reportAndReturn<any>(
        `[Studio.loadModel] Unsupported model format: ${params.format}`,
        SDKErrorType.InvalidInput,
      );
      return err;
    }

    // SceneModel and DataModel for the same load share a single
    // id — that's what `TreeView._addModel`, `loadDataset`, and
    // every "find the paired model" lookup expects. Earlier code
    // suffixed `-scene` / `-data` here, which made the pair
    // unresolvable.
    //
    // Returns the lazily-resolved SceneModel / DataModel pair, or
    // an `{ok: false, ...}` short-circuit when creation failed —
    // the caller checks via the `failure` field before proceeding
    // with the load. Reporting is centralised through
    // `reportError` so the IssuesPanel sees the failure.
    let sceneModel: SceneModel | undefined;
    if (descriptor.needsScene) {
      if (params.sceneModel) {
        sceneModel = params.sceneModel;
      } else {
        const sRes = this.scene.createModel({id: params.modelId, coordinateSystem});
        if (sRes.ok === false) {
          this.reportError(sRes);
          return sRes;
        }
        sceneModel = sRes.value;
      }
    }
    let dataModel: DataModel | undefined;
    if (descriptor.needsData) {
      if (params.dataModel) {
        dataModel = params.dataModel;
      } else {
        const dRes = this.data.createModel({id: params.modelId});
        if (dRes.ok === false) {
          this.reportError(dRes);
          return dRes;
        }
        dataModel = dRes.value;
      }
    }

    // Give the locator a chance to load its catalog (e.g. which models have
    // optimized variants) before it resolves — only when we're actually
    // resolving (no explicit src). Idempotent and non-throwing by contract.
    if (!params.src && this.locator.preload) {
      await this.locator.preload();
    }
    const src = params.src ?? this.locator.resolve(params.modelId, params.format);
    const fileData = await Studio._fetchAs(src, descriptor.fetch);

    // Resolve referenced files (e.g. a 3D Tiles tileset's content) against the
    // directory the model was fetched from, unless the caller set a baseUri.
    const slash = src.lastIndexOf("/");
    const baseUri = options?.baseUri ?? (slash >= 0 ? src.slice(0, slash + 1) : undefined);

    const loadRes = await descriptor.load(
      {fileData, sceneModel, dataModel},
      {...options, baseUri},
    );
    // Report loader-side failures through the same channel so the
    // IssuesPanel sees them alongside Studio-side ones. The result
    // still flows back to the caller unchanged.
    if (loadRes && (loadRes as any).ok === false) {
      this.reportError(loadRes);
    }
    return loadRes;
  }

  /**
   * Internal helper — dispatch a string error and return an
   * `{ok: false, ...}` SDKResult mirroring it. Lets the loadModel
   * (and similar) early-return paths report + return in one line.
   */
  private _reportAndReturn<T>(message: string, type: SDKErrorType): SDKResult<T> {
    const payload: SDKResult<T> = {ok: false, type, error: message};
    this.reportError(payload);
    return payload;
  }

  private static async _fetchAs(src: string, kind: FormatFetchKind): Promise<any> {
    const response = await fetch(src);
    switch (kind) {
      case "arrayBuffer": return response.arrayBuffer();
      case "json":        return response.json();
      case "text":        return response.text();
    }
  }

  /**
   * Best-effort fetch of the per-model `coordSys.json` sidecar via
   * {@link locator.resolveSidecar}, returning the parsed
   * `CoordinateSystemParams` when the file exists or `undefined`
   * when it doesn't (404, network error, malformed JSON — every
   * failure mode is treated the same, since the file is optional
   * and the caller falls back to SceneModel's default coordinate
   * system).
   *
   * @param modelId Model directory name under the helper's models root.
   */
  private async _loadCoordSys(modelId: string): Promise<CoordinateSystemParams | undefined> {
    const url = this.locator.resolveSidecar(modelId, "coordSys.json");
    try {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      const json = await response.json();
      return json as CoordinateSystemParams;
    } catch {
      return undefined;
    }
  }

  /**
   * Studio's `onViewCreated` hook for the {@link ViewManager}. Runs
   * after the manager has created the View, its CameraFlight, and
   * its ViewController — layers on the right-click context menus
   * and the procedurally-generated HDR sky.
   */
  private _onViewCreated(view: View, record: ViewRecord): void {

    const {cameraFlight} = record;

    // Right-click context menu — routes through the unified picker
    // for object id (no snap requested → cheap BVH path) and displays
    // ViewObjectContextMenu / CanvasContextMenu accordingly.
    //
    // NOTE — does NOT call `e.preventDefault()` here. The native
    // browser menu suppression is the {@link ViewController}'s job
    // (it sets `view.htmlElement.oncontextmenu = e => e.preventDefault()`
    // during construction). Examples that don't instantiate a
    // ViewController will see the browser's native menu fire alongside
    // the Studio one — accepted as the user-controllable trade-off
    // rather than unconditionally suppressing it here.
    const tryPick = (e: MouseEvent) => {

      const rect = view.htmlElement.getBoundingClientRect();
      const pickResult = this.picking.picker.pick({
        view,
        canvasPos: [e.clientX - rect.left, e.clientY - rect.top],
      });

      if (pickResult.hit && pickResult.objectId) {
        const viewObject = view.objects[pickResult.objectId];
        if (viewObject) {
          const sceneModel = viewObject.sceneObject.model;
          const dataModel = sceneModel ? this.data.models[sceneModel.id] : null;

          this._viewObjectContextMenu.context = <ViewObjectContextMenuContext>{
            view,
            studio: this,
            renderer: this.renderer,
            cameraFlight,
            viewObject,
            sceneModel,
            dataModel,
            collisionIndex: this.picking.collisionIndex,
            pickedWorldPos: pickResult.worldPos ?? null,
          };
          this._viewObjectContextMenu.show(e.clientX, e.clientY);
          taskRunner.suspend();
          return;
        }
      }

      this._canvasContextMenu.context = <CanvasContextMenuContext>{
        view,
        studio: this,
        renderer: this.renderer,
        cameraFlight,
        sceneModel: this._getDefaultSceneModel(),
        dataModel:  this._getDefaultDataModel(),
        collisionIndex: this.picking.collisionIndex,
      };
      this._canvasContextMenu.show(e.clientX, e.clientY);
      taskRunner.suspend();
    };

    view.htmlElement.addEventListener("contextmenu", tryPick);

    // Procedurally generate an HDR sun-sky environment aligned with
    // the View's directional-light direction and load it as the IBL.
    const sunWorld = (() => {
      const sd = view.effects.shadows.direction;
      const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
      return [-sd[0] / sl, -sd[1] / sl, -sd[2] / sl];
    })();

    const hdrPixels = paintSunSkyHDR(512, 256, {sunDirection: sunWorld as any});
    const hdrBuf = encodeRadianceHDR(hdrPixels, 512, 256);
    const hdrResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);
    if (hdrResult.ok === false) {
      this.reportWarning(`[Studio] HDR sky setup failed: ${hdrResult.error}`);
    }

    // Adaptive quality on by default for every Studio View: drops to
    // NavigationRender while the camera moves, back to RealisticRender at
    // rest. Self-destructs when the View is destroyed. The Adaptive Quality
    // panel toggles this same per-View adapter.
    new AdaptiveQuality({view});
  }

  /**
   * Destroys both the {@link model!scene.SceneModel | SceneModel} and the {@link model!data.DataModel | DataModel}
   * that share `modelId` (when each exists). Either side may be
   * absent — a model loaded via {@link loadModel} with no
   * `dataModel` argument leaves the data side empty, and a model
   * loaded with `datamodel` only leaves the scene side empty —
   * and the call succeeds whichever combination is found.
   *
   * Pairs with how {@link loadDataset} mints SceneModel +
   * DataModel under the same `id` so a "delete this model"
   * action in the UI is the natural inverse: one call wipes
   * both halves without the caller having to know which loader
   * path produced them.
   *
   * @param modelId The ID shared by the SceneModel / DataModel
   *   to destroy (typically `SceneModel.id` from the active
   *   selection).
   * @returns A small report of what was actually destroyed —
   *   useful when the caller wants to log/announce only the
   *   sides that existed.
   */
  public destroyModel(modelId: string): {
    sceneModelDestroyed: boolean;
    dataModelDestroyed: boolean;
  } {
    let sceneModelDestroyed = false;
    let dataModelDestroyed = false;

    const sceneModel = this.scene?.models?.[modelId];
    if (sceneModel && !sceneModel.destroyed) {
      try {
        sceneModel.destroy();
        sceneModelDestroyed = true;
      } catch (e: any) {
        this.reportWarning(
          `[Studio.destroyModel] SceneModel '${modelId}' destroy threw: ${e?.message ?? e}`,
        );
      }
    }

    const dataModel = this.data?.models?.[modelId];
    if (dataModel && !dataModel.destroyed) {
      try {
        dataModel.destroy();
        dataModelDestroyed = true;
      } catch (e: any) {
        this.reportWarning(
          `[Studio.destroyModel] DataModel '${modelId}' destroy threw: ${e?.message ?? e}`,
        );
      }
    }

    this._modelOrigins.delete(modelId);

    return {sceneModelDestroyed, dataModelDestroyed};
  }

  /** Provenance recorded by the ImportDialog, keyed by modelId. */
  private readonly _modelOrigins = new Map<string, ImportProvenance>();

  /**
   * Record where a freshly-loaded model came from. The ModelsPanel
   * reads this back via {@link getModelOrigin} to display "loaded
   * via …" details. Cleared by {@link destroyModel}.
   */
  public recordModelOrigin(modelId: string, provenance: ImportProvenance): void {
    this._modelOrigins.set(modelId, provenance);
  }

  /** Provenance for `modelId`, or `undefined` if none was recorded. */
  public getModelOrigin(modelId: string): ImportProvenance | undefined {
    return this._modelOrigins.get(modelId);
  }

  /**
   * Lazily creates a {@link ScenePhysics} system, attaches every
   * SceneObject of `sceneModel` (or every SceneObject of every
   * SceneModel if no model is passed) as a dynamic Rapier body, and
   * applies a downward gravity so the parts drop and "demolish"
   * themselves.
   *
   * "Downward" is derived from {@link Scene.coordinateSystem}.worldUp
   * — gravity points in `-worldUp`, which makes the demolition look
   * the same regardless of whether the scene is Y-up, Z-up, or any
   * other orientation. SceneModels with their own coordinate-system
   * basis still fall the right way because Rapier bodies live in
   * world space and the SceneModel's `coordinateSystemMatrix` has
   * already mapped them there.
   *
   * The physics system, Rapier WASM module, and per-frame `step()`
   * loop are only created on the first call — demos that never
   * demolish anything pay nothing. Gravity is locked in at that first
   * call from the Scene's worldUp; later calls don't re-derive it.
   *
   * Each object gets a small randomised initial angular + lateral
   * velocity so the disassembly looks chaotic instead of monolithic.
   *
   * @param sceneModel SceneModel whose objects should be turned
   *   into dynamic bodies. When omitted, every SceneModel currently
   *   in the Scene is demolished.
   * @returns SDKResult — `ok: false` if Rapier failed to load.
   */
  async demolishModel(sceneModel?: SceneModel): Promise<SDKResult<void>> {
    if (!this._demolitionPhysics) {
      // Rapier isn't a static dependency of the SDK — pull the
      // WASM-bundled compat build from CDN on first demolition. Same
      // package the simulation_physics_duplex example uses.
      const rapierUrl = "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm";
      let mod: any;
      try {
        mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ rapierUrl);
      } catch (e) {
        return {
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[Studio.demolishModel] Failed to load Rapier from CDN: ${e instanceof Error ? e.message : String(e)}`
        };
      }
      const RAPIER = mod.default || mod;
      if (typeof RAPIER.init === "function") {
        await RAPIER.init();
      }
      // Pull world-up from the Scene's coordinate system and flip it
      // to get "down" in world space. Magnitude is tuned for a slow,
      // theatrical fall; the rotational chaos below makes the result
      // read as "demolition" rather than "object dropped."
      const worldUp = this.scene.coordinateSystem.worldUp;
      const gMag = 2.0;
      const gravity: [number, number, number] = [
        -worldUp[0] * gMag,
        -worldUp[1] * gMag,
        -worldUp[2] * gMag
      ];
      this._demolitionPhysics = getScenePhysics(this.scene, {
        rapier: RAPIER,
        gravity,
        autoCreateBodies: false
      });
      this._startDemolitionLoop();
    }
    const physics = this._demolitionPhysics;

    const models: SceneModel[] = sceneModel
      ? [sceneModel]
      : Object.values(this.scene.models);

    for (const model of models) {
      for (const objectId in model.objects) {
        physics.setBody(objectId, {
          type: "dynamic",
          shape: "cuboid",
          density: 1.0,
          friction: 0.5,
          restitution: 0.05
        });
        const body = physics.getBody(objectId);
        if (body) {
          body.setAngvel({
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() - 0.5) * 0.5,
            z: (Math.random() - 0.5) * 0.5
          }, true);
          // Small lateral jitter on every axis. Gravity along
          // -worldUp dominates the fall direction; this just keeps
          // the parts from descending in lock-step.
          body.setLinvel({
            x: (Math.random() - 0.5) * 0.3,
            y: (Math.random() - 0.5) * 0.3,
            z: (Math.random() - 0.5) * 0.3
          }, true);
        }
      }
    }
    return {ok: true, value: undefined};
  }

  // Drives `physics.step()` once per animation frame. Started by the
  // first demolishModel() call; auto-stops when the Scene is destroyed
  // (getScenePhysics cleans the cache, leaving _demolitionPhysics
  // dangling — we detect that via the scene's destroyed flag).
  private _startDemolitionLoop(): void {
    const tick = () => {
      const physics = this._demolitionPhysics;
      if (!physics || this.scene.destroyed) {
        this._demolitionRaf = null;
        return;
      }
      physics.step();
      this._demolitionRaf = requestAnimationFrame(tick);
    };
    this._demolitionRaf = requestAnimationFrame(tick);
  }

  /**
   * Gets the primary view used by the inspector panels.
   *
   * @returns The first available view, or `undefined` when none exist.
   */
  private _getInspectorView(): View | undefined {
    return this.viewer?.viewList?.[0];
  }

  /**
   * Gets a default scene model for canvas-level actions.
   *
   * @returns The first available scene model, or `undefined` when none exist.
   */
  private _getDefaultSceneModel(): SceneModel | undefined {
    for (const modelId in this.scene.models) {
      return this.scene.models[modelId];
    }
    return undefined;
  }

  /**
   * Gets a default data model for canvas-level actions.
   *
   * @returns The first available data model, or `undefined` when none exist.
   */
  private _getDefaultDataModel(): DataModel | undefined {
    for (const modelId in this.data.models) {
      return this.data.models[modelId];
    }
    return undefined;
  }

  /**
   * Toggle the DistanceMeasurementTool's mouse control on `view`,
   * ensuring the tool exists first. Returns the
   * `MouseDistanceMeasurementsControl` after the toggle.
   *
   * This is a domain operation — not a panel open/hide — so it stays
   * as a direct method rather than going through {@link panels}.
   */
  public toggleDistanceMeasurementsControl(view: View) {
    const tool = this.panels.open("distanceMeasurements", {view});
    if (!tool) return undefined;
    const mc = tool.mouseControl;
    if (mc.active) mc.deactivate();
    else mc.activate();
    return mc;
  }

  /**
   * Toggle the AngleMeasurementsTool's mouse control on `view`,
   * ensuring the tool exists first. Returns the
   * `MouseAngleMeasurementsControl` after the toggle.
   */
  public toggleAngleMeasurementsControl(view: View) {
    const tool = this.panels.open("angleMeasurements", {view});
    if (!tool) return undefined;
    const mc = tool.mouseControl;
    if (mc.active) mc.deactivate();
    else mc.activate();
    return mc;
  }

  /**
   * Mount the {@link TransformControls} on `view` (creating
   * them on first call), attach them to `target`, and switch
   * to `mode` when supplied.
   *
   * `pivotWorld` is the world-space anchor the handles render
   * around — typically the surface point the picker returned from
   * the click that triggered the attach.
   */
  public attachTransformControls(
    view: View,
    target: TransformControlsTarget,
    mode?: TransformControlsMode,
    pivotWorld?: Vec3,
  ) {
    const tc = this.panels.open("transformControls", {view});
    if (!tc) return undefined;
    tc.attach(target, pivotWorld ? {pivotWorld} : undefined);
    if (mode) tc.setMode(mode);
    return tc;
  }

  /**
   * Detach the {@link TransformControls} on `view` if mounted.
   * Leaves the controls live so the next {@link attachTransformControls}
   * call reuses the same instance.
   */
  public detachTransformControls(view: View): void {
    this.panels.get("transformControls", {view})?.detach();
  }

  /**
   * Replace the helper's Scene + Data contents with a single
   * named dataset from the demo model catalog
   * (`models/index.json`). Loads `formats` sequentially into a
   * fresh SceneModel + DataModel pair and frames the camera on the result.
   *
   * @returns The newly-created SceneModel + DataModel on success,
   *          or an SDK error result if any phase fails.
   */
  public async loadDataset(params: {
    modelId: string;
    formats: string[];
    /**
     * When true (default), every existing SceneModel + DataModel
     * in the helper's Scene / Data is destroyed before the new
     * one is created. Pass false to load alongside whatever's
     * already there.
     */
    clear?: boolean;
    /**
     * Optional override for the cooperative-yield throttle, in
     * milliseconds. See
     * {@link formats!ModelLoadOptions.yieldIntervalMs | yieldIntervalMs}
     * — passed through to every per-format `loadModel` call so a
     * single override applies across the whole dataset load.
     * Raise above the 16ms default for noticeably faster large
     * loads at the cost of less-frequent progress updates.
     */
    yieldIntervalMs?: number;
  }): Promise<SDKResult<{ sceneModel: SceneModel; dataModel: DataModel }>> {
    const {modelId, formats} = params;
    const clear = params.clear !== false;
    if (!modelId || !formats || formats.length === 0) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[Studio.loadDataset] modelId and formats are required",
      };
    }

    if (clear) {
      // Destroy in two passes — Scene first (so renderer drops
      // its references) then Data. SceneModel.destroy() is
      // idempotent and the destroy event handlers in our index
      // tables will clear themselves.
      for (const id of Object.keys(this.scene.models)) {
        const m = this.scene.models[id];
        if (m && !m.destroyed) m.destroy();
      }
      for (const id of Object.keys(this.data.models)) {
        const m = this.data.models[id];
        if (m && !m.destroyed) m.destroy();
      }
    }

    // Use a unique id per load so the same dataset can be loaded
    // again without colliding when `clear` is false.
    const instanceId = clear ? modelId : `${modelId}-${Date.now()}`;

    // If the model directory ships a `coordSys.json`, feed it
    // to `scene.createModel` so the SceneModel knows its native
    // axes/units. Missing file → undefined → SceneModel falls
    // back to its built-in default.
    const coordinateSystem = await this._loadCoordSys(modelId);

    const sceneCreate = this.scene.createModel({id: instanceId, coordinateSystem});
    if (sceneCreate.ok === false) {
      return {ok: false, type: SDKErrorType.Unknown, error: sceneCreate.error};
    }
    const sceneModel = sceneCreate.value;

    const dataCreate = this.data.createModel({id: instanceId});
    if (dataCreate.ok === false) {
      try {
        sceneModel.destroy();
      } catch { /* ignore */
      }
      return {ok: false, type: SDKErrorType.Unknown, error: dataCreate.error};
    }
    const dataModel = dataCreate.value;

    // Wrap the per-format load loop in a LoaderProgressDialog so
    // long loads paint a bar / phase label, and the user can
    // hit Cancel. The dialog's delayed-paint policy means short
    // loads finish without a dialog ever appearing. Loaders
    // that respect the cooperative-yield contract (every parser
    // swept under formats/) honour the signal + onProgress;
    // loaders that don't run to completion as before.
    const totalFormats = formats.length;
    // Captured-error pattern: the per-format `loadModel` outcomes
    // are SDKResults. A failure inside the runWith callback used
    // to throw to exit the loop — now we stash the failure here
    // and `return` from the callback, then propagate after
    // `runWith` resolves. Keeps the routing throw-free.
    let innerFailure: SDKResult<any> | null = null;
    try {
      await LoaderProgressDialog.runWith({
        title: `Loading ${modelId} (${formats.join(", ")})`,
        run: async (onProgress, signal) => {
          for (let i = 0; i < formats.length; i++) {
            const format = formats[i];
            // Bracket each format's parser with a top-level
            // emit so the user sees coarse progress between
            // formats too — useful for multi-format datasets
            // where one format finishes fast and the next is
            // long.
            onProgress({
              phase: `Loading ${format}`,
              current: i,
              total: totalFormats,
            });
            const r = await this.loadModel(
              {modelId, format, sceneModel, dataModel},
              {onProgress, signal, yieldIntervalMs: params.yieldIntervalMs || 60},
            );
            if (r && (r as any).ok === false) {
              // loadModel already dispatched reportError on the
              // failure, so it's in the IssuesPanel; just capture
              // for the outer return.
              innerFailure = r as SDKResult<any>;
              return;
            }
          }
          // Final phase before resolution so the bar reads as
          // "done" rather than truncating mid-format.
          onProgress({phase: "Finalising", current: totalFormats, total: totalFormats});
          const view = this._getInspectorView();
          if (view) {
            try {
              const aabb = this.picking.collisionIndex.getSceneAABB();
              if (aabb) this.viewManager.fitToAabb(view, aabb);
            } catch { /* ignore */
            }
          }
        },
      });
      if (innerFailure) {
        try { sceneModel.destroy(); } catch { /* ignore */ }
        try { dataModel.destroy(); } catch { /* ignore */ }
        return innerFailure;
      }
      return {ok: true, value: {sceneModel, dataModel}};
    } catch (err: any) {
      // Best-effort cleanup so a half-loaded dataset doesn't
      // leave the Scene in a stuck state. AbortError + parser
      // failures both land here.
      try {
        sceneModel.destroy();
      } catch { /* ignore */
      }
      try {
        dataModel.destroy();
      } catch { /* ignore */
      }
      const isAbort = err && err.name === "AbortError";
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: isAbort
          ? "[Studio.loadDataset] cancelled by user"
          : `[Studio.loadDataset] ${err && err.message || err}`,
      };
    }
  }

  /**
   * Open the floating per-example info panel. Single-instance:
   * a second call destroys the previously-opened panel before
   * constructing a fresh one, so an example always has at most
   * one info card on screen. The caller gets the panel handle
   * back and uses its imperative builders to populate it:
   *
   * ```ts
   * const info = studio.openInfoPanel({
   *   id:          "viewing_sectionPlane_duplex",
   *   title:       "Section Caps — Duplex",
   *   description: "<p>Drag the slider to move the cut plane.</p>",
   * });
   * info.addToggle({ label: "Section plane", value: true,
   *                  onChange: v => sp.active = v });
   * info.addSlider({ label: "Cut Z (m)", min: 0, max: 5,
   *                  value: 2.6, onChange: rebuildCaps });
   * info.addStat  ({ id: "caps", label: "Cap meshes" });
   * // …later:
   * info.setStat("caps", String(result.numCapMeshes));
   * ```
   *
   * Layout / chrome notes:
   * - Default position is top-left so the panel doesn't compete
   *   with the built-in panels that cluster top-right.
   * - Non-modal: scene interaction passes through the body.
   * - Per-example `localStorage` slot via {@link InfoPanelParams.id}.
   */
  public openInfoPanel(params: InfoPanelParams = {}): InfoPanel {
    // `destroy()` on the base is idempotent — safe to call on a
    // panel that may already be destroyed.
    this._infoPanel?.destroy();
    this._infoPanel = new InfoPanel(params);
    return this._infoPanel;
  }

  /**
   * Open an InfoPanel pre-populated from the example's own
   * `index.json` metadata. Single line for every example:
   *
   * ```ts
   * const info = await studio.openInfoPanelFromMeta();
   * info.addToggle({...});   // optional — chain controls if needed
   * ```
   *
   * Fetches `./index.json` (relative to the current page URL) and
   * uses its `id`, `title`, and `description` fields to build the
   * panel. If the fetch fails or the JSON is malformed, the
   * promise still resolves with a generic panel rather than
   * rejecting — examples never break because of a missing
   * metadata file.
   *
   * Callers that need richer descriptions or want to override
   * the metadata can pass `override` props that win over
   * the fetched fields.
   */
  public async openInfoPanelFromMeta(
    override: Partial<InfoPanelParams> = {},
  ): Promise<InfoPanel> {
    let meta: { id?: string; title?: string; description?: string } | null = null;
    try {
      const url = new URL("./index.json", window.location.href).href;
      const res = await fetch(url);
      if (res.ok) meta = await res.json();
    } catch {
      /* fall through — the panel still opens with a default title */
    }
    const params: InfoPanelParams = {
      id:          override.id          ?? meta?.id,
      title:       override.title       ?? meta?.title       ?? "Info",
      description: override.description ?? (meta?.description
        ? `<p>${escapeHtmlForInfoPanel(meta.description)}</p>`
        : undefined),
      container:   override.container,
    };
    return this.openInfoPanel(params);
  }

  /**
   * Finalizes the demo setup, gathering statistics and signaling completion.
   */
  public finished(): void {

    const stats = this.stats;

    stats.scene = this._getCombinedSceneModelStats();
    stats.data = this._getCombinedDataModelStats();
    const sceneAABB = this.picking.collisionIndex.getSceneAABB();
    stats.aabb = sceneAABB ? Array.from(sceneAABB) : [];
    stats.endTime = performance.now();
    stats.elapsedTime = stats.endTime - (stats.startTime ?? stats.endTime);

    if (this.renderer instanceof WebGLRenderer) {
      stats.renderer = {
        tiles: {},
        views: []
      };
      stats.memory = this.renderer.getMemoryUsage();
      const result = this.renderer.getRenderInspector();
      if (result.ok) {
        const renderInspector = result.value;
        stats.renderer = renderInspector.renderStats;
      }
    }

    setInterval(() => {
      window.postMessage({
        type: "xeokit.visualTestJson",
        payload: {
          stats: this.stats
        }
      }, "*");
    }, 1000);

    sdkProgress.completeTask();

    this.signalFinished();
  }

  private signalFinished(): void {
    const div = document.createElement("div");
    div.id = "ExampleLoaded";
    document.body.appendChild(div);
  }

  private _getCombinedSceneModelStats(): SceneModelStats {

    const combinedStats: SceneModelStats = {
      numTransforms: 0,
      numObjects: 0,
      numMeshes: 0,
      numGeometries: 0,
      numTextures: 0,
      numMaterials: 0,
      numTriangles: 0,
      numLines: 0,
      numPoints: 0,
      numVertices: 0,
      textureBytes: 0,
    };

    for (const modelId in this.scene.models) {
      const model = this.scene.models[modelId];
      const stats = model.stats;
      combinedStats.numObjects += stats.numObjects;
      combinedStats.numGeometries += stats.numGeometries;
      combinedStats.numTextures += stats.numTextures;
      combinedStats.numTriangles += stats.numTriangles;
      combinedStats.numPoints += stats.numPoints;
      combinedStats.numLines += stats.numLines;
      combinedStats.numVertices += stats.numVertices;
      combinedStats.numMeshes += stats.numMeshes;
      combinedStats.numMaterials += stats.numMaterials;
      combinedStats.textureBytes += stats.textureBytes;
    }

    return combinedStats;
  }

  private _getCombinedDataModelStats(): DataModelStats {

    const combinedStats: DataModelStats = {
      numObjects: 0,
      numRelationships: 0,
      numPropertySets: 0
    };

    for (const modelId in this.data.models) {
      const model = this.data.models[modelId];
      const stats = model.stats;
      combinedStats.numObjects += stats.numObjects;
      combinedStats.numRelationships += stats.numRelationships;
      combinedStats.numPropertySets += stats.numPropertySets;
    }
    return combinedStats;
  }
}
