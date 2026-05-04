import {Scene, SceneModel, type SceneModelStats, type CoordinateSystemParams} from "../scene";
import {Data, DataModel, type DataModelStats} from "../data";
import {type PickParams, PickResult, View, Viewer, ViewObject, type ViewParams} from "../viewer";
import {type MemoryUsage, WebGLRenderer} from "../webglrenderer";
import {EventsLogger, getGlobalTaskRunner, sdkProgress, SDKErrorType, type SDKResult, SDKTask} from "../core";
import {SceneAABB3Index} from "../collision/aabb";
import {ScenePicker, SceneCollisionIndex} from "../collision/bvh";
import {CameraFlightAnimation} from "../cameraflight";
import {type RenderStats} from "../webglrenderer/internal/inspectors";
import {ViewController} from "../viewcontroller";
import {ScenePanel} from "./inspectors/ScenePanel";
import {DataPanel} from "./inspectors/DataPanel";
import {ShadersPanel} from "./inspectors/ShadersPanel";
import {RendererPanel} from "./inspectors/RendererPanel";
import {FloatingPanelFlowHost} from "./inspectors/FloatingPanelFlowHost";
import {TaskPanel} from "./inspectors/TaskPanel";
// Aliased so it doesn't collide with the newer floating
// `BoundariesPanel` widget at `./boundariesPanel/`. This legacy
// import is the static-class panel that `toggleInspector()`
// mounts inside the FloatingPanelFlowHost; the floating widget
// is the one `openBoundariesPanel()` works with.
import {BoundariesPanel as LegacyBoundariesPanelInspector} from "./inspectors/BoundariesPanel";
import {DataTexturesPanel} from "./inspectors/DataTexturesPanel";
// Aliased so it doesn't collide with the newer floating
// `TilesPanel` widget at `./tilesPanel/`. Same pattern as the
// BoundariesPanel split — this legacy import is the
// static-class panel `toggleInspector()` mounts inside the
// FloatingPanelFlowHost; the floating widget is the one
// `openTilesPanel()` works with.
import {TilesPanel as LegacyTilesPanelInspector} from "./inspectors/TilesPanel";
import {DownloadPanel} from "./inspectors/DownloadPanel";
import {SceneHealthPanel} from "./sceneHealthPanel/SceneHealthPanel";
import {BoundariesPanel} from "./boundariesPanel/BoundariesPanel";
import {TilesPanel} from "./tilesPanel/TilesPanel";
import {SceneStatsPanel} from "./sceneStats/SceneStatsPanel";
import {DataStatsPanel} from "./dataStats/DataStatsPanel";
import {SampleModelsPanel} from "./sampleModelsPanel/SampleModelsPanel";
import {SchemaMaterialsPanel} from "./schemaMaterialsPanel/SchemaMaterialsPanel";
import {ViewerConfigPanel} from "./viewerPanel/ViewerConfigPanel";
import {GPUMemoryPanel} from "./gpuMemoryUsage/GPUMemoryUsage";
import {Toolbar} from "./toolbar/Toolbar";
import {ExportDialog} from "./exportDialog/ExportDialog";
import {ExplorerPanel} from "./explorerPanel/ExplorerPanel";
import {EventsPanel} from "./eventsPanel/EventsPanel";
import {LoaderProgressDialog} from "./loaderProgressDialog/LoaderProgressDialog";
import {createUUID} from "../utils";
import {
  CanvasContextMenu,
  type CanvasContextMenuContext,
  ViewObjectContextMenu,
  type ViewObjectContextMenuContext
} from "./ViewObjectContextMenu";
import {XGFLoader} from "../formats/xgf";
import {IFCLoader} from "../formats/ifc";
import {MetaModelLoader} from "../formats/metamodel";
import {DataModelParamsLoader} from "../formats/datamodel";
import {GLTFLoader} from "../formats/gltf";
import {SceneModelParamsLoader} from "../formats/scenemodel";
import {MTLLoader} from "../formats/mtl";
import {DotBIMLoader} from "../formats/dotbim";
import {OBJLoader} from "../formats/obj";
import {CityJSONLoader} from "../formats/cityjson";
import {LoadingSpinner} from "./LoadingSpinner";
import {encodeRadianceHDR, paintSunSkyHDR} from "../procgen/paintEnvironments";
import {getScenePhysics, type ScenePhysics} from "./physics";

const taskRunner = getGlobalTaskRunner();

/**
 * Configuration options for the DemoHelper.
 */
export interface DemoHelperConfig {

  /**
   * Base directory for loading models, relative to the HTML page. Defaults to `"../../models"`.
   */
  modelsDir?: string;

  /**
   * The maximum number of views to create. This is used to configure the WebGLRenderer's memory management,
   * and also limits the number of views that can be created via `createView()`. Defaults to `4`.
   */
  maxViews?: number;


  makeComponents?: boolean;

  /**
   * Whether to set up event loggers for the Scene, Data, Viewer, and WebGLRenderer. Defaults to `false`.
   * These loggers will log their output to the console, and do slow down the demo, so they should only
   * be enabled when needed for debugging.
   */
  logging?: boolean;


  showOverlayButton?: boolean;
}

/**
 * Helper class to set up a basic 3D demo with a Scene, Data, Viewer, WebGLRenderer, and View.
 *
 * See {@link demo | @xeokit/sdk/demo} for usage.
 */
export class DemoHelper {

  /**
   * Base directory for loading models, relative to the HTML page.
   */
  public modelsDir: string = "../../models";

  /**
   * The Scene created by the DemoHelper. Holds all 3D objects.
   */
  public scene: Scene;

  /**
   * Dynamically tracks the 3D boundaries of the objects in the Scene.
   * Used by the BoundariesPanel inspector. Distinct from the
   * {@link SceneCollisionIndex} that powers fly-to and picking — both
   * track AABBs but the collision index also maintains the BVH.
   */
  private _aabb3Index: SceneAABB3Index;

  /**
   * BVH index used for fly-to AABB queries and as the spatial back-end
   * of {@link _picker}. Lazy-built on first access via
   * {@link collisionIndex}.
   */
  private _collisionIndex: SceneCollisionIndex;

  /**
   * Triangle-precise ray picker layered on {@link _collisionIndex}.
   * Lazy-built on first access via {@link picker}.
   */
  private _picker: ScenePicker;

  /**
   * The Data created by the DemoHelper. Holds all data models.
   */
  public data: Data;

  /**
   * The Viewer created by the DemoHelper.
   */
  public viewer: Viewer;

  /**
   * The WebGLRenderer created by the DemoHelper.
   */
  public renderer: WebGLRenderer;

  /**
   * Tracks created Views by their IDs, along with their associated CameraFlightAnimation and ViewController.
   */
  public views: {
    [viewId: string]: {
      view: View;
      cameraFlight: CameraFlightAnimation;
      viewController: ViewController;
    };
  };

  /**
   * The maximum number of views to create.
   */
  public maxViews: number;

  private makeComponents: boolean;
  private showOverlayButton: boolean;
  private overlayButton: HTMLButtonElement | null = null;
  private inspectorVisible: boolean = false;
  private inspectorFlowHost: HTMLDivElement;

  private eventsLog: any[];

  /**
   * Root layout container for auto-created canvases.
   */
  private _viewLayoutContainer: HTMLDivElement | null = null;

  /**
   * Tracks auto-created canvases by view ID.
   */
  private _autoCanvasByViewId: { [viewId: string]: HTMLImageElement } = {};

  private _viewObjectContextMenu: ViewObjectContextMenu;

  private _canvasContextMenu: CanvasContextMenu;

  private _loadingSpinner: LoadingSpinner;

  // Lazy-initialised by demolishModel(). Stays undefined until the
  // first call so demos that never demolish anything don't pay for
  // Rapier load + ScenePhysics setup.
  private _demolitionPhysics?: ScenePhysics;
  private _demolitionRaf: number | null = null;

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
   * Creates a DemoHelper instance.
   * @param cfg
   */
  constructor(cfg: DemoHelperConfig = {}) {
    if (cfg.modelsDir) {
      this.modelsDir = cfg.modelsDir;
    }
    this.makeComponents = cfg.makeComponents !== false;
    this.showOverlayButton = cfg.showOverlayButton !== false;
    this.maxViews = cfg.maxViews ?? 4;
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
    this.eventsLog = [];
  }

  /**
   * Initializes the DemoHelper by creating the Scene, Data, Viewer, WebGLRenderer, and optional initial View.
   *
   * @param cfg Configuration options for initialization.
   * @returns A promise that resolves when initialization is complete.
   */
  public init(cfg: DemoHelperConfig = {}): Promise<any> {

    return new Promise((resolve, reject) => {

      this.stats.startTime = performance.now();

      if (this.makeComponents) {

        this.scene = new Scene();

        this.data = new Data();

        this.viewer = new Viewer();

        this.renderer = new WebGLRenderer({
          // memoryConfigs: {whats
          //   maxViews: this.maxViews ?? (cfg.maxViews ?? 1),
          //   tileSize: 200,
          //   maxTiles: 2000,
          //   maxBatches: 300,
          //   maxBatchVertices: 70000,
          //   maxBatchIndices: 170000,
          //   maxBatchGeometries: 10000,
          //   maxBatchMeshes: 20000,
          //   maxBatchPrims: 1000000
          // }
          memoryConfigs: {
            maxViews: this.maxViews ?? (cfg.maxViews ?? 1),
            tileSize: 200,
            maxTiles: 2000,
            maxBatches: 300,
            maxBatchVertices: 70000,
            maxBatchIndices: 90000,
            maxBatchGeometries: 60000,
            maxBatchMeshes: 10000,
            maxBatchPrims: 70000
          }
        });

        const log = (eventName: string, sender: any, args: any) => {
          console.log(`[${sender.constructor.name.padEnd(14)}] ${eventName}`, args);
        };

        if (cfg.logging) {
          new EventsLogger(this.scene.events, {prefix: "[Scene        ]", log});
          new EventsLogger(this.data.events, {prefix: "[Data         ]", log});
          new EventsLogger(this.viewer.events, {prefix: "[Viewer       ]", log});
          new EventsLogger(this.renderer.events, {prefix: "[WebGLRenderer]", log});
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

        // Pre-mount the EventsPanel (hidden) so it begins
        // capturing onError emissions before the user opens it
        // via the context menu — and so the very first error
        // can auto-show the panel even when nothing else has
        // touched the helper. Idempotent: `getEventsPanel`
        // returns this same instance later.
        try {
          EventsPanel.openFor({
            viewer: this.viewer,
            scene: this.scene,
            data: this.data,
            renderer: this.renderer,
            visible: false,
          });
        } catch (e: any) {
          console.warn("[DemoHelper.init] Failed to mount EventsPanel:", e?.message ?? e);
        }

        this.viewer.attachScene(this.scene);
        this.renderer.attachViewer(this.viewer);

        this.views = {};

        const renderInspectorResult = this.renderer.getRenderInspector();
        if (renderInspectorResult.ok !== true) {
          reject(renderInspectorResult.error);
          return;
        }
        const renderInspector = renderInspectorResult.value;
        renderInspector.enabled = true;

        this._viewObjectContextMenu = new ViewObjectContextMenu({});

        this._canvasContextMenu = new CanvasContextMenu({});

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

        // const dimensionsModelResult = this.scene.createModel({
        //   id: "autoDimensionsModel"
        // });
        //
        // if (dimensionsModelResult.ok === false) {
        //   throw new Error(dimensionsModelResult.error);
        // }
        //
        // const dimensionsModel = dimensionsModelResult.value;
        //
        // const autoDimensions = new AutoDimensions({
        //   sceneModel: dimensionsModel,
        //   scene: this.scene,
        //   data: this.data,
        //   aabb3index: this.aabb3Index,
        //   color: [1.0, 1.0, 1.0],
        //   offset: 1.55,
        //   extensionOvershoot: 0.35,
        //   includedDataObjectTypes: ["Wall", "Door", "Window", "IfcWall", "IfcDoor", "IfcWindow"],
        //   tickSize: 0.12,
        //   autoUpdate: true,
        //   plane: "XY",
        //   planeGap: 0
        // });

        // @ts-ignore
        window.demoHelper = this;

        resolve({});
      } else {
        resolve({});
      }
    });
  }

  /**
   * Loads a model into the Scene and/or Data layers using a format-specific loader.
   *
   * This method:
   * - Resolves or creates {@link SceneModel} and {@link DataModel} instances when not provided
   * - Fetches model data from `params.src` or a default path derived from `modelId`
   * - Selects the appropriate loader based on `params.format`
   * - Delegates parsing and population to the corresponding loader implementation
   *
   * Supported formats:
   * - `"xgf"` → {@link XGFLoader} (binary)
   * - `"ifc"` → {@link IFCLoader} (binary)
   * - `"gltf"` → {@link GLTFLoader} (binary, `.glb`)
   * - `"metamodel"` → {@link MetaModelLoader} (JSON, data-only)
   * - `"datamodel"` → {@link DataModelParamsLoader} (JSON, data-only)
   * - `"scenemodel"` → {@link SceneModelParamsLoader} (JSON, scene-only)
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
   * @param params.dataModel - Optional existing {@link DataModel} to populate
   * @param params.sceneModel - Optional existing {@link SceneModel} to populate
   *
   * @param options - Loader-specific options passed through to the underlying loader
   *
   * @returns A promise resolving to an {@link SDKResult} containing the loader result
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

    const getSceneModel = () => {
      if (params.sceneModel) {
        return params.sceneModel;
      }
      const result = this.scene.createModel({
        id: params.modelId ? `${params.modelId}-scene` : undefined,
        coordinateSystem,
      });
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.value;
    };

    const getDataModel = () => {
      if (params.dataModel) {
        return params.dataModel;
      }
      const result = this.data.createModel({
        id: params.modelId ? `${params.modelId}-data` : undefined
      });
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.value;
    };

    const loadArrayBuffer = async (src: string) => {
      const response = await fetch(src);
      return response.arrayBuffer();
    };

    const loadJSON = async (src: string) => {
      const response = await fetch(src);
      return response.json();
    };

    const loadText = async (src: string) => {
      const response = await fetch(src);
      return response.text();
    };

    switch (params.format) {
      case "xgf": {
        const fileData = await loadArrayBuffer(params.src || `../../models/${params.modelId}/xgf/model.xgf`);
        return new XGFLoader().load({
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      case "ifc": {
        const fileData = await loadArrayBuffer(params.src || `../../models/${params.modelId}/ifc/model.ifc`
        );

        return new IFCLoader().load(
          {
            fileData,
            sceneModel: getSceneModel(),
            dataModel: getDataModel()
          },
          options
        );
      }

      case "gltf": {
        const fileData = await loadArrayBuffer(params.src || `../../models/${params.modelId}/gltf/model.glb`
        );

        return new GLTFLoader().load(
          {
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      case "mtl": {
        const fileData = await loadText(
          params.src || `../../models/${params.modelId}/mtl/model.mtl`
        );

        return new MTLLoader().load(
          {
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      case "obj": {
        const fileData = await loadText(
          params.src || `../../models/${params.modelId}/obj/model.obj`
        );

        return new OBJLoader().load(
          {
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      case "dotbim": {
        const fileData = await loadArrayBuffer(
          params.src || `../../models/${params.modelId}/dotbim/model.bim`
        );

        return new DotBIMLoader().load(
          {
            fileData,
            sceneModel: getSceneModel(),
            dataModel: getDataModel()
          },
          options
        );
      }

      case "cityjson": {
        const fileData = await loadJSON(
          params.src || `../../models/${params.modelId}/cityjson/model.json`
        );

        return new CityJSONLoader().load(
          {
            fileData,
            sceneModel: getSceneModel(),
            dataModel: getDataModel()
          },
          options
        );
      }

      case "metamodel": {
        const fileData = await loadJSON(
          params.src || `../../models/${params.modelId}/metamodel/model.json`
        );

        return new MetaModelLoader().load(
          {
            fileData,
            dataModel: getDataModel()
          },
          options
        );
      }

      case "datamodel": {
        const fileData = await loadJSON(
          params.src || `../../models/${params.modelId}/datamodel/model.json`
        );

        return new DataModelParamsLoader().load(
          {
            fileData,
            dataModel: getDataModel()
          },
          options
        );
      }

      case "scenemodel": {
        const fileData = await loadJSON(
          params.src || `../../models/${params.modelId}/scenemodel/model.json`
        );

        return new SceneModelParamsLoader().load(
          {
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      default:
        throw new Error(`Unsupported model format: ${params.format}`);
    }
  }

  /**
   * Best-effort fetch of `../../models/${modelId}/coordSys.json`,
   * returning the parsed `CoordinateSystemParams` when the file
   * exists or `undefined` when it doesn't (404, network error,
   * malformed JSON — every failure mode is treated the same,
   * since the file is optional and the caller falls back to
   * SceneModel's default coordinate system).
   *
   * @param modelId Model directory name under the helper's models root.
   * @param src Optional explicit URL override; defaults to the
   *   conventional `coordSys.json` path beside the model files.
   */
  private async _loadCoordSys(
    modelId: string,
    src?: string,
  ): Promise<CoordinateSystemParams | undefined> {
    const url = src || `../../models/${modelId}/coordSys.json`;
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
   * Creates a new View in the Viewer.
   *
   * When `viewParams.elementId` and `viewParams.htmlElement` are omitted,
   * this method auto-creates a canvas element, passes it to `viewer.createView`,
   * and lays it out snugly with other auto-created canvases inside the window.
   *
   * Auto-created canvases are given `z-index: 100000`.
   *
   * The first View created becomes the DemoHelper's primary `view`, and gets
   * a `CameraFlightAnimation` and `ViewController`.
   *
   * @param viewParams Parameters for the View.
   * @returns The created View.
   */
  createView(viewParams: ViewParams = {}): View {

    if (!this.viewer) {
      throw new Error("Viewer not initialized");
    }

    const resolvedViewParams: ViewParams = {
      id: viewParams.id || createUUID(),
      backgroundColor: [0, 0, 0],
      transparent: false,
      ...viewParams
    };

    const hasExplicitElement = !!(resolvedViewParams.elementId || resolvedViewParams.htmlElement);

    let autoCreatedCanvas: HTMLImageElement | null = null;
    let viewId = resolvedViewParams.id;

    if (!hasExplicitElement) {
      this._ensureViewLayoutContainer();

      autoCreatedCanvas = document.createElement("img");
      autoCreatedCanvas.id = viewId ? `${viewId}-canvas` : `demohelper-canvas-${this.viewer.numViews}`;
      autoCreatedCanvas.style.display = "block";
      autoCreatedCanvas.style.width = "100%";
      autoCreatedCanvas.style.height = "100%";
      autoCreatedCanvas.style.minWidth = "0";
      autoCreatedCanvas.style.minHeight = "0";
      autoCreatedCanvas.style.margin = "0";
      autoCreatedCanvas.style.padding = "0";
      autoCreatedCanvas.style.border = "1px solid white";
      autoCreatedCanvas.style.outline = "none";
      autoCreatedCanvas.style.boxSizing = "border-box";
      autoCreatedCanvas.style.background = "black";
      autoCreatedCanvas.style.position = "relative";
      autoCreatedCanvas.style.pointerEvents = "auto";
      autoCreatedCanvas.style.userSelect = "none";
      autoCreatedCanvas.draggable = false;
      //autoCreatedCanvas.style.zIndex = "1";

      this._viewLayoutContainer!.appendChild(autoCreatedCanvas);

      // @ts-ignore
      resolvedViewParams.htmlElement = autoCreatedCanvas;
      delete (resolvedViewParams as any).elementId;
    }

    const result = this.viewer.createView(resolvedViewParams);

    if (result.ok === false) {
      if (autoCreatedCanvas?.parentElement) {
        autoCreatedCanvas.parentElement.removeChild(autoCreatedCanvas);
      }
      throw new Error(result.error);
    }

    const view = result.value;

    if (autoCreatedCanvas) {
      this._autoCanvasByViewId[view.id] = autoCreatedCanvas;
      autoCreatedCanvas.setAttribute("data-view-id", view.id);
      autoCreatedCanvas.id = `${view.id}-canvas`;
      this._updateAutoCanvasLayout();
    }

    const cameraFlight = new CameraFlightAnimation(view);

    this.views[view.id] = {
      view,
      cameraFlight,
      viewController: new ViewController(view, {
        // ViewController picks (orbit-around-pivot, follow-pointer, hover
        // events) go through ScenePicker too, so the entire DemoHelper
        // picking path is BVH-based and renderer.pick is never invoked.
        // Snap-to-vertex / snap-to-edge fall back to renderer.pick because
        // the BVH path doesn't model them.
        pick: (view: View, pickParams: PickParams): SDKResult<PickResult> => {
          return this._pickViaBvh(view, pickParams);
        }
      })
    };

    // Attach a mouse click listener to the View's canvas, and show our ContextMenu
    // when the user right-clicks on an object in the View.
    //
    // Picking goes through ScenePicker (BVH + triangle-precise M-T) instead
    // of renderer.pick — same `canvasPos` input but no GPU pipeline stall,
    // and a triangle-level hit point for the Frame-on-pick actions.

    const tryPick = (view, e) => {

      const rect = view.htmlElement.getBoundingClientRect();
      const result = this.picker.pick({
        view,
        canvasPos: [e.clientX - rect.left, e.clientY - rect.top]
      });

      if (result.ok === false) {
        console.error("[DemoHelper.tryPick]", result.error);
        return;
      }

      const pickResult = result.value;

      if (pickResult.hit) {
        // BVH returns the SceneObject id; resolve the corresponding
        // ViewObject so the existing context-menu plumbing keeps working.
        const viewObject = view.objects[pickResult.objectId];
        if (viewObject) {
          const sceneModel = viewObject.sceneObject.model;
          const dataModel = sceneModel ? this.data.models[sceneModel.id] : null;

          this._viewObjectContextMenu.context = <ViewObjectContextMenuContext>{
            view,
            demoHelper: this,
            renderer: this.renderer,
            cameraFlight,
            viewObject,
            sceneModel,
            dataModel,
            collisionIndex: this.collisionIndex
          };
          this._viewObjectContextMenu.show(e.clientX, e.clientY);
          taskRunner.suspend();
          return;
        }
      }

      this._canvasContextMenu.context = <CanvasContextMenuContext>{
        view,
        demoHelper: this,
        renderer: this.renderer,
        cameraFlight,
        sceneModel: this._getDefaultSceneModel(),
        dataModel: this._getDefaultDataModel(),
        collisionIndex: this.collisionIndex
      };
      this._canvasContextMenu.show(e.clientX, e.clientY);
      taskRunner.suspend();
    };

    view.htmlElement.addEventListener("contextmenu", e => tryPick(view, e));
    //this._viewLayoutContainer.addEventListener("contextmenu", e => tryPick(view, e));

    const sunWorld = (() => {
      const sd = view.effects.shadows.direction;
      const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
      return [-sd[0] / sl, -sd[1] / sl, -sd[2] / sl];
    })();

    const hdrPixels = paintSunSkyHDR(512, 256, {sunDirection: sunWorld as any});
    const hdrBuf = encodeRadianceHDR(hdrPixels, 512, 256);
    const hdrResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);
    if (hdrResult.ok === false) {
      console.warn("[DemoHelper]", hdrResult.error);
    }

    return view;
  }

  /**
   * ViewController-shape picking, served from ScenePicker.
   *
   * Adapts the viewer-side `PickParams`/`PickResult` contract that
   * ViewController and PickController expect to the BVH stack. Falls back
   * to `renderer.pick` only for snap-to-vertex / snap-to-edge requests,
   * which the BVH path doesn't model.
   *
   * Populates the fields PickController + the mouse handlers actually
   * consume: `viewObject`, `canvasPos`, `worldPos`. Other fields stay
   * unset, which the consumer treats as "not picked" for those facets
   * (e.g. `worldNormal` is null → no surface-normal-aware behaviour).
   */
  private _pickViaBvh(view: View, pickParams: PickParams): SDKResult<PickResult> {

    // if (pickParams.snapToVertex || pickParams.snapToEdge) {
    //   // Snap is a feature only the GPU-pick path implements. Defer.
    //   return this.renderer.pick(view, pickParams);
    // }

    const result = this.picker.pick({
      view,
      canvasPos: pickParams.canvasPos,
      ray: pickParams.rayPick && pickParams.rayOrigin && pickParams.rayDirection
        ? {origin: pickParams.rayOrigin, dir: pickParams.rayDirection}
        : undefined,
      matrix: pickParams.rayMatrix,
      visiblePickableOnly: pickParams.pickInvisible !== true
    });

    if (result.ok === false) return result;

    if (!result.value.hit) {
      return {ok: true, value: null as any};
    }

    const viewObject = view.objects[result.value.objectId!];
    const pickResult = new PickResult();
    pickResult.view = view;
    pickResult.viewObject = viewObject ?? null;
    if (viewObject) {
      pickResult.sceneObject = viewObject.sceneObject;
    }
    if (pickParams.canvasPos) {
      pickResult.canvasPos = pickParams.canvasPos;
    }
    pickResult.worldPos = result.value.worldPos as any;
    pickResult.origin = result.value.rayOrigin;
    pickResult.direction = result.value.rayDir;

    return {ok: true, value: pickResult};
  }

  /**
   * Fits the camera of the given View to the Scene's AABB.
   *
   * AABB comes from the {@link collisionIndex} BVH — same source the
   * picker and context-menu fly-to actions read from, so all three stay
   * in sync as the Scene mutates.
   *
   * @param view
   */
  viewFit(view: View) {
    const viewData = this.views[view.id];
    if (!viewData) {
      throw new Error(`View with ID ${view.id} not found`);
    }
    const {cameraFlight} = viewData;
    const aabb = this.collisionIndex.getSceneAABB();
    if (aabb) {
      cameraFlight.jumpTo({
        aabb,
        fitFOV: 45
      });
    }
  }

  /**
   * Destroys a View created by `createView()`, removing its canvas if it was auto-created.
   * @param view
   */
  destroyView(view: View) {
    if (!this.viewer) {
      throw new Error("Viewer not initialized");
    }
    const viewId = view.id;
    if (this._autoCanvasByViewId[viewId]) {
      const canvas = this._autoCanvasByViewId[viewId];
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      delete this._autoCanvasByViewId[viewId];
      this._updateAutoCanvasLayout();
    }
    view.destroy();
    delete this.views[viewId];
  }

  /**
   * Destroys both the {@link SceneModel} and the {@link DataModel}
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
        console.warn(`[DemoHelper.destroyModel] SceneModel '${modelId}' destroy threw:`, e?.message ?? e);
      }
    }

    const dataModel = this.data?.models?.[modelId];
    if (dataModel && !dataModel.destroyed) {
      try {
        dataModel.destroy();
        dataModelDestroyed = true;
      } catch (e: any) {
        console.warn(`[DemoHelper.destroyModel] DataModel '${modelId}' destroy threw:`, e?.message ?? e);
      }
    }

    return {sceneModelDestroyed, dataModelDestroyed};
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
      // package the ScenePhysics_Duplex example uses.
      const rapierUrl = "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm";
      let mod: any;
      try {
        mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ rapierUrl);
      } catch (e) {
        return {
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[DemoHelper.demolishModel] Failed to load Rapier from CDN: ${e instanceof Error ? e.message : String(e)}`
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
   * Gets the SceneAABB3Index for the Scene, which dynamically tracks the 3D boundaries of the objects in the Scene.
   */
  get aabb3Index(): SceneAABB3Index {
    if (!this._aabb3Index) {
      this._aabb3Index = new SceneAABB3Index(this.scene);
    }
    return this._aabb3Index;
  }

  /**
   * Gets the {@link SceneCollisionIndex} for this demo's Scene, used by
   * fly-to (AABB queries) and the {@link picker}.
   *
   * Self-maintaining: invalidates on object create/destroy/move and
   * rebuilds lazily on the next query. Shared module-level singleton via
   * `getSceneCollisionIndex` so multiple consumers cooperate.
   */
  get collisionIndex(): SceneCollisionIndex {
    if (!this._collisionIndex) {
      this._collisionIndex = new SceneCollisionIndex(this.scene);
    }
    return this._collisionIndex;
  }

  /**
   * Gets the {@link ScenePicker} for this demo's Scene. Wraps the
   * {@link collisionIndex} BVH and adds triangle-precise raycasting,
   * `canvasPos | ray | matrix` input dispatch, and view-side
   * visible/pickable filtering.
   */
  get picker(): ScenePicker {
    if (!this._picker) {
      this._picker = new ScenePicker(this.scene);
    }
    return this._picker;
  }

  /**
   * Shows or hides the inspectors and keeps related UI state in sync.
   *
   * @param visible Whether inspectors should be visible.
   * @param view Optional active view whose pointer-events should be updated.
   */
  private _setInspectorVisible(visible: boolean, view?: View | null): void {
    this.inspectorVisible = visible;

    if (this.inspectorFlowHost) {
      this.inspectorFlowHost.style.display = visible ? "flex" : "none";
    }

    if (view?.htmlElement) {
      view.htmlElement.style.pointerEvents = visible ? "none" : "all";
    }

    if (visible) {
      taskRunner.suspend();
    } else {
      taskRunner.unsuspend();
    }

    this._updateInspectorButton();
  }

  /**
   * Updates the inspector toggle button label and visual state.
   */
  private _updateInspectorButton(): void {
    if (!this.overlayButton) {
      return;
    }

    const isOpen = this.inspectorVisible;
    this.overlayButton.innerHTML =
      `<span style="vertical-align: middle;">${isOpen ? "Close Inspectors" : "Open Inspectors"}</span>`;
    this.overlayButton.classList.toggle("demohelper-open", isOpen);
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
   * Opens a {@link SceneHealthPanel} bound to `sceneModel`,
   * mounting one if no panel currently exists for that model.
   *
   * @param focusSceneModel Optional SceneModel to focus on open.
   *                        When the panel is already mounted and
   *                        showing a different model, focus
   *                        switches to this one.
   * @returns The panel instance — newly mounted, re-revealed, or
   *          the unchanged already-visible instance.
   */
  public getSceneHealthPanel(focusSceneModel?: SceneModel): SceneHealthPanel {
    const existing = SceneHealthPanel.getFor(this.scene);
    if (existing) {
      if (!existing.visible) existing.show();
      if (focusSceneModel) existing.focusModel(focusSceneModel);
      return existing;
    }
    return SceneHealthPanel.openFor({
      scene: this.scene,
      focusSceneModel,
      view: this._getInspectorView(),
      demoHelper: this,
    });
  }

  /**
   * Opens a {@link BoundariesPanel} bound to `scene`, mounting
   * one if no panel currently exists for that Scene.

   * @returns The panel instance — newly mounted, re-revealed, or
   *          the unchanged already-visible instance.
   */
  public openBoundariesPanel(): BoundariesPanel | undefined {
    const view = this._getInspectorView();
    if (!view) {
      console.warn("[DemoHelper.openBoundariesPanel] No View available — BoundariesPanel needs a View for the camera-pose pointer.");
      return undefined;
    }
    const existing = BoundariesPanel.getFor(this.scene);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return BoundariesPanel.openFor({scene: this.scene, view});
  }

  /**
   * Opens a {@link TilesPanel} bound to `scene`, mounting one if
   * no panel currently exists for that Scene.
   *
   * @returns The panel instance, or `undefined` when the
   *          renderer has no `RenderInspector` available or the
   *          helper has no Views attached.
   */
  public openTilesPanel(): TilesPanel | undefined {
    const view = this._getInspectorView();
    if (!view) {
      console.warn("[DemoHelper.openTilesPanel] No View available — TilesPanel needs a View for the camera-pose pointer.");
      return undefined;
    }
    const inspectorRes = this.renderer.getRenderInspector();
    if (inspectorRes.ok === false) {
      console.warn("[DemoHelper.openTilesPanel] Renderer doesn't expose a RenderInspector:", inspectorRes.error);
      return undefined;
    }
    const inspector = inspectorRes.value;
    inspector.enabled = true;     // make sure the tile map is being populated
    const renderStats = inspector.renderStats;

    const existing = TilesPanel.getFor(this.scene);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return TilesPanel.openFor({renderStats, scene: this.scene, view});
  }

  /**
   * Opens a {@link SceneStatsPanel} bound to the helper's
   * {@link scene}, mounting one if no panel currently exists for
   * that Scene.
   */
  public openSceneStatsPanel(): SceneStatsPanel {
    const existing = SceneStatsPanel.getFor(this.scene);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return SceneStatsPanel.openFor({scene: this.scene});
  }

  /**
   * Opens a {@link DataStatsPanel} bound to the helper's
   * {@link data}, mounting one if no panel currently exists for
   * that Data graph.
   */
  public openDataStatsPanel(): DataStatsPanel {
    const existing = DataStatsPanel.getFor(this.data);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return DataStatsPanel.openFor({data: this.data});
  }

  /**
   * Opens (or returns the live) {@link ExportDialog} bound to
   * this helper.
   */
  public openExportDialog(): ExportDialog {
    const existing = ExportDialog.getFor(this);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return ExportDialog.openFor({demoHelper: this});
  }

  /**
   * Opens (or returns the live) {@link ExplorerPanel} bound
   * to this helper's `Data` graph.
   */
  public getExplorer(): ExplorerPanel | undefined {
    const view = this._getInspectorView();
    if (!view) {
      console.warn("[DemoHelper.getExplorer] No View available — Explorer needs a View for visibility checkboxes.");
      return undefined;
    }
    const existing = ExplorerPanel.getFor(this.data);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return ExplorerPanel.openFor({data: this.data, view});
  }

  /**
   * Mounts (or reveals) the singleton {@link EventsPanel} bound
   * to this helper's `Viewer`. The panel subscribes to the
   * `onError` channel of `Scene`, `Data`, `Viewer`, and
   * `WebGLRenderer` at construction so it begins capturing
   * events immediately — even when the user hasn't opened it
   * yet — and pops itself open the first time an error fires
   * during a session.
   */
  public getEventsPanel(): EventsPanel | undefined {
    if (!this.viewer || !this.scene || !this.data || !this.renderer) {
      console.warn("[DemoHelper.getEventsPanel] Helper not fully initialised yet — Viewer/Scene/Data/WebGLRenderer must exist.");
      return undefined;
    }
    const existing = EventsPanel.getFor(this.viewer);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return EventsPanel.openFor({
      viewer: this.viewer,
      scene: this.scene,
      data: this.data,
      renderer: this.renderer,
      visible: true,
    });
  }

  /**
   * Mounts (or returns the live) {@link Toolbar} bound to the
   * helper's {@link viewer} — the floating row of icon buttons
   * (Explorer · Reset · 2D/3D · Perspective/Ortho · Fit-All ·
   * First-Person · Hide · Select · Marquee). Idempotent — same
   * "don't disturb if already open" semantics as the other panel
   * openers.
   */
  public openToolbar(): Toolbar {
    const existing = Toolbar.getFor(this.viewer);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return Toolbar.openFor({viewer: this.viewer, demoHelper: this});
  }

  /**
   * Hide the toolbar's row of buttons (the small "Toolbar" pill
   * remains so the user can pull it back). No-op when no toolbar
   * has been mounted.
   */
  public hideToolbar(): void {
    const existing = Toolbar.getFor(this.viewer);
    if (existing) existing.hide();
  }

  /**
   * Toggle toolbar visibility — same idempotence semantics as
   * {@link openToolbar}; constructs the toolbar on first call.
   */
  public toggleToolbar(): Toolbar {
    const existing = Toolbar.getFor(this.viewer);
    if (existing) {
      existing.toggle();
      return existing;
    }
    return this.openToolbar();
  }

  /**
   * Opens (or returns the live) {@link GPUMemoryPanel} bound to
   * the helper's {@link renderer}.

   */
  public getGPUMemoryPanel(): GPUMemoryPanel {
    const existing = GPUMemoryPanel.getFor(this.renderer);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return GPUMemoryPanel.openFor({renderer: this.renderer});
  }

  /**
   * Opens a {@link ViewerConfigPanel} bound to the helper's
   * {@link viewer}, mounting one if no panel currently exists for
   * that Viewer.
   */
  public openViewerConfigPanel(): ViewerConfigPanel {
    const existing = ViewerConfigPanel.getFor(this.viewer);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return ViewerConfigPanel.openFor({viewer: this.viewer});
  }

  /**
   * Opens a {@link SchemaMaterialsPanel} bound to `sceneModel` and
   * the matching {@link DataModel} in the helper's Data graph.
   */
  public openSchemaMaterialsPanel(sceneModel: SceneModel): SchemaMaterialsPanel | undefined {
    const dataModel = this.data.models[sceneModel.id];
    if (!dataModel) {
      console.warn(`[DemoHelper.openSchemaMaterialsPanel] No DataModel found for SceneModel '${sceneModel.id}' — Schema Materials needs DataObjects to group by schema and type.`);
      return undefined;
    }
    const existing = SchemaMaterialsPanel.getFor(sceneModel);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return SchemaMaterialsPanel.openFor({sceneModel, dataModel});
  }

  /**
   * Reveal (or lazily mount) the floating
   * {@link SampleModelsPanel} bound to this DemoHelper. The
   * panel surfaces every model in `models/index.json`, lets the
   * user load any dataset into the helper's Scene + Data with
   * one click, and stays usable across panels (close + reopen
   * via its pill, drag to reposition, etc).
   */
  public showSampleModels(): SampleModelsPanel {
    const existing = SampleModelsPanel.getFor(this);
    if (existing) {
      if (!existing.visible) existing.show();
      return existing;
    }
    return SampleModelsPanel.openFor({demoHelper: this});
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
     * {@link "@xeokit/sdk/formats".ModelLoadOptions.yieldIntervalMs}
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
        error: "[DemoHelper.loadDataset] modelId and formats are required",
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
              throw new Error((r as any).error || `loadModel failed for format '${format}'`);
            }
          }
          // Final phase before resolution so the bar reads as
          // "done" rather than truncating mid-format.
          onProgress({phase: "Finalising", current: totalFormats, total: totalFormats});
          const view = this._getInspectorView();
          if (view) {
            try {
              this.viewFit(view);
            } catch { /* ignore */
            }
          }
        },
      });
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
          ? "[DemoHelper.loadDataset] cancelled by user"
          : `[DemoHelper.loadDataset] ${err && err.message || err}`,
      };
    }
  }

  /**
   * Toggles the visibility of the floating inspector panels.
   */
  public toggleInspector(): void {

    const view = this._getInspectorView();

    if (!view) {
      console.warn("No views available to inspect");
      return;
    }

    if (this.inspectorVisible) {
      this._setInspectorVisible(false, view);
      return;
    }

    if (!this.inspectorFlowHost) {

      this.inspectorFlowHost = FloatingPanelFlowHost.getOrCreate({
        corner: "top-right",
        marginTopPx: 65,
        zIndex: 100000,
        maxWidth: 2000,
        tileMinWidth: 800,
      });

      DownloadPanel.show(this.inspectorFlowHost, this.scene, this.data);

      // GPU memory config + usage are now the unified, live-syncing
      // floating GPUMemoryPanel — opened on demand via context
      // menu / getGPUMemoryPanel(). The legacy inspector-flow tiles
      // are removed; the flow host stays for the other read-only
      // tile inspectors above.

      ScenePanel.show(this.inspectorFlowHost, this.scene, {});

      DataPanel.show(this.inspectorFlowHost, this.data, {});

      const shaderInspectorResult = this.renderer.getShaderInspector();
      if (shaderInspectorResult.ok) {
        ShadersPanel.show(this.inspectorFlowHost, shaderInspectorResult.value);
      }

      const renderInspectorResult = this.renderer.getRenderInspector();
      if (renderInspectorResult.ok) {
        RendererPanel.show(this.inspectorFlowHost, this.renderer);
        const renderInspector = renderInspectorResult.value;
        const renderStats = renderInspector.renderStats;
        LegacyTilesPanelInspector.show(this.inspectorFlowHost, renderStats);
      }

      TaskPanel.show(this.inspectorFlowHost, taskRunner, {});

      if (view) {
        LegacyBoundariesPanelInspector.show(this.inspectorFlowHost, view, this.aabb3Index, {});
      }

      const memoryInspectorResult = this.renderer.getMemoryInspector();
      if (memoryInspectorResult.ok) {
        const memoryInspector = memoryInspectorResult.value;
        const dataTextures = memoryInspector.dataTextures;
        DataTexturesPanel.show(this.inspectorFlowHost, dataTextures);
      }

      // Viewer config UI is now the floating ViewerConfigPanel
      // (opened on demand via context menu / openViewerConfigPanel),
      // not the legacy inspector-flow tile. The flow-host stays for
      // the other read-only inspectors above.
    }

    this._setInspectorVisible(true, view);
  }

  /**
   * Finalizes the demo setup, gathering statistics and signaling completion.
   */
  public finished(): void {

    this._createOverlayButton();

    const stats = this.stats;

    stats.scene = this._getCombinedSceneModelStats();
    stats.data = this._getCombinedDataModelStats();
    stats.aabb = Array.from(this.aabb3Index.getSceneAABB());
    stats.endTime = performance.now();
    stats.elapsedTime = stats.endTime - (stats.startTime ?? stats.endTime);

    if (this.renderer) {
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

  private _ensureViewLayoutContainer(): HTMLDivElement {
    if (typeof document === "undefined") {
      throw new Error("Document is not available");
    }

    if (this._viewLayoutContainer) {
      return this._viewLayoutContainer;
    }

    const container = document.createElement("div");
    container.id = "xeokit-demohelper-view-layout";
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.display = "grid";
    container.style.gridAutoFlow = "row";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.gap = "0";
    container.style.boxSizing = "border-box";
    container.style.overflow = "hidden";
    //container.style.zIndex = "100000";
    container.style.pointerEvents = "auto";
    container.style.background = "transparent";

    document.body.appendChild(container);
    this._viewLayoutContainer = container;

    const relayout = () => {
      this._updateAutoCanvasLayout();
    };

    window.addEventListener("resize", relayout);

    return container;
  }

  private _updateAutoCanvasLayout(): void {
    if (!this._viewLayoutContainer) {
      return;
    }

    const numCanvases = Object.keys(this._autoCanvasByViewId).length;

    if (numCanvases <= 0) {
      this._viewLayoutContainer.style.gridTemplateColumns = "";
      this._viewLayoutContainer.style.gridTemplateRows = "";
      return;
    }

    const cols = Math.ceil(Math.sqrt(numCanvases));
    const rows = Math.ceil(numCanvases / cols);

    this._viewLayoutContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    this._viewLayoutContainer.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    this._viewLayoutContainer.style.alignItems = "stretch";
    this._viewLayoutContainer.style.justifyItems = "stretch";

    for (const viewId in this._autoCanvasByViewId) {
      const canvas = this._autoCanvasByViewId[viewId];
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
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

  private _createOverlayButton(): void {

    if (typeof document === "undefined") {
      return;
    }

    if (this.overlayButton) {
      return;
    }

    const button = document.createElement("button");
    button.style.position = "fixed";
    button.style.top = "16px";
    button.style.right = "16px";
    button.style.zIndex = "100001";
    button.style.padding = "8px 16px";
    button.style.background = "#dedede";
    button.style.color = "black";
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.fontSize = "16px";
    button.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

    button.onmouseenter = () => {
      button.style.background = "#ffff";
    };

    button.onmouseleave = () => {
      button.style.background = "#dedede";
    };

    button.onclick = () => {
      this.toggleInspector();
    };

    document.body.appendChild(button);
    this.overlayButton = button;
    this._updateInspectorButton();
  }
}
