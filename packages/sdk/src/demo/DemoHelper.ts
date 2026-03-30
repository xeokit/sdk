import {Scene, SceneModel, type SceneModelStats} from "../scene";
import {Data, DataModel, type DataModelStats} from "../data";
import {type PickParams, type PickResult, View, Viewer, ViewObject, type ViewParams} from "../viewer";
import {type MemoryUsage, WebGLRenderer} from "../webglrenderer";
import {EventsLogger, getGlobalTaskRunner, sdkProgress, type SDKResult, SDKTask} from "../core";
import {SceneAABB3Index} from "../collision/aabb";
import {CameraFlightAnimation} from "../cameraflight";
import {type RenderStats} from "../webglrenderer/internal/inspectors";
import {ViewController} from "../viewcontroller";
import {GPUMemoryConfigsPanel} from "./inspectors/GPUMemoryConfigsPanel";
import {GPUMemoryUsagePanel} from "./inspectors/GPUMemoryUsagePanel";
import {ScenePanel} from "./inspectors/ScenePanel";
import {DataPanel} from "./inspectors/DataPanel";
import {ShadersPanel} from "./inspectors/ShadersPanel";
import {RendererPanel} from "./inspectors/RendererPanel";
import {FloatingPanelFlowHost} from "./inspectors/FloatingPanelFlowHost";
import {TaskPanel} from "./inspectors/TaskPanel";
import {BoundariesPanel} from "./inspectors/BoundariesPanel";
import {DataTexturesPanel} from "./inspectors/DataTexturesPanel";
import {TilesPanel} from "./inspectors/TilesPanel";
import {ViewerPanel} from "./inspectors/ViewerPanel";
import {DownloadPanel} from "./inspectors/DownloadPanel";
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
   */
  private _aabb3Index: SceneAABB3Index;

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
          // memoryConfigs: {
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
            maxBatchVertices: 100000,
            maxBatchIndices: 100000,
            maxBatchGeometries: 10000,
            maxBatchMeshes: 10000,
            maxBatchPrims: 100000
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

        this._viewObjectContextMenu = new ViewObjectContextMenu({
        });

        this._canvasContextMenu = new CanvasContextMenu({
        });

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
    const getSceneModel = () => {
      if (params.sceneModel) {
        return params.sceneModel;
      }
      const result = this.scene.createModel({
        id: params.modelId ? `${params.modelId}-scene` : undefined
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
      if (result.ok===false) {
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
        const fileData = await loadArrayBuffer(
          params.src || `../../models/${params.modelId}/xgf/model.xgf`
        );
        return new XGFLoader().load(
          {
            fileData,
            sceneModel: getSceneModel()
          },
          options
        );
      }

      case "ifc": {
        const fileData = await loadArrayBuffer(
          params.src || `../../models/${params.modelId}/ifc/model.ifc`
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
        const fileData = await loadArrayBuffer(
          params.src || `../../models/${params.modelId}/gltf/model.glb`
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
      backgroundColor: [0,0,0],
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
      resolvedViewParams.htmlElement = autoCreatedCanvas ;
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
        pick: (view: View, pickParams: PickParams): SDKResult<PickResult> => {
          return this.renderer.pick(view, pickParams);
        }
      })
    };

    // Attach a mouse click listener to the View's canvas, and show our ContextMenu
    // when the user right-clicks on an object in the View.

    const tryPick = (view, e) => {

      const result = this.renderer.pick(view, {
        canvasPos: [e.offsetX, e.offsetY]
      });

      if (result) {
        if (result.ok) {
          const pickResult = result.value;
          if (pickResult && pickResult.viewObject) {

            const viewObject = pickResult.viewObject;
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
              aabb3index:  this.aabb3Index
            };
            this._viewObjectContextMenu.show(e.clientX, e.clientY);
              taskRunner.suspend();
          } else {
            this._canvasContextMenu.context = <CanvasContextMenuContext>{
              view,
              demoHelper: this,
              renderer: this.renderer,
              cameraFlight,
              sceneModel: this._getDefaultSceneModel(),
              dataModel: this._getDefaultDataModel(),
              aabb3index:  this.aabb3Index
            };
            this._canvasContextMenu.show(e.clientX, e.clientY);
            taskRunner.suspend();
          }
        }
      } else {

        // TODO: Open empty canmvas menu

        console.log("Nothing picked");
      }
    };

    view.htmlElement.addEventListener("contextmenu", e => tryPick(view, e));
    //this._viewLayoutContainer.addEventListener("contextmenu", e => tryPick(view, e));

    return view;
  }

  /**
   * Fits the camera of the given View to the Scene's AABB.
   * @param view
   */
  viewFit(view: View) {
    const viewData = this.views[view.id];
    if (!viewData) {
      throw new Error(`View with ID ${view.id} not found`);
    }
    const {cameraFlight} = viewData;
    const aabb = this.aabb3Index.getSceneAABB();
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
   * Gets the SceneAABB3Index for the Scene, which dynamically tracks the 3D boundaries of the objects in the Scene.
   */
  get aabb3Index(): SceneAABB3Index {
    if (!this._aabb3Index) {
      this._aabb3Index = new SceneAABB3Index(this.scene);
    }
    return this._aabb3Index;
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

      GPUMemoryConfigsPanel.show(this.inspectorFlowHost, this.renderer.getMemoryConfigs());

      GPUMemoryUsagePanel.show(this.inspectorFlowHost, this.renderer.getMemoryUsage());

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
        TilesPanel.show(this.inspectorFlowHost, renderStats);
      }

      TaskPanel.show(this.inspectorFlowHost, taskRunner, {});

      if (view) {
        BoundariesPanel.show(this.inspectorFlowHost, view, this.aabb3Index, {});
      }

      const memoryInspectorResult = this.renderer.getMemoryInspector();
      if (memoryInspectorResult.ok) {
        const memoryInspector = memoryInspectorResult.value;
        const dataTextures = memoryInspector.dataTextures;
        DataTexturesPanel.show(this.inspectorFlowHost, dataTextures);
      }

      const viewerParamsResult = this.viewer.toParams();
      if (viewerParamsResult.ok) {
        const viewerParams = viewerParamsResult.value;
        ViewerPanel.show(this.inspectorFlowHost, viewerParams);
      }
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
