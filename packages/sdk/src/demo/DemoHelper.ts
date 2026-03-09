import {Scene, type SceneModelStats} from "../scene";
import {Data, type DataModelStats} from "../data";
import {View, Viewer} from "../viewer";
import {type MemoryUsage, WebGLRenderer} from "../webglrenderer";
import {EventsLogger, getGlobalTaskRunner, type SDKResult, SDKTask} from "../core";
import {SceneAABB3Index} from "../collision/aabb";
import {CameraFlightAnimation} from "../cameraflight";
import {type RenderStats} from "../webglrenderer/internal/inspectors";
import {CameraControl} from "../cameracontrol";
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
import {LoadingProgressBar} from "./LoadingProgressBar";
import {DownloadPanel} from "./inspectors/DownloadPanel";

const taskRunner = getGlobalTaskRunner();

/**
 * Configuration options for the DemoHelper.
 */
export interface DemoHelperConfig {
  makeView?: boolean;
  maxViews?: number;
  makeComponents?: boolean;
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
   * The Scene created by the DemoHelper. Holds all 3D objects.
   */
  public scene: Scene;

  /**
   * Dynamically tracks the 3D boundaries of the objects in the Scene.
   */
  public aabb3Index: SceneAABB3Index;

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
   * The View created by the DemoHelper.
   */
  public view: View;

  /**
   * The CameraFlightAnimation for the View.
   */
  public cameraFlight: CameraFlightAnimation;

  /**
   * The CameraControl for the View, allowing user interaction with the camera.
   */
  public cameraControl: CameraControl;

  /**
   * The maximum number of views to create.
   */
  public maxViews: number;

  /**
   * A progress bar for loading operations, which you can use in your demo code to show loading progress.
   */
  //public loadingProgressBar = new LoadingProgressBar();

  // /**
  //  * A inspectors for building demo models with a fluent API. You can use this in your demo code to create models in the scene and data.
  //  */
  // public builder: DemoBuilder;

  private makeView: boolean;
  private makeComponents: boolean;
  private showOverlayButton: boolean;
  private overlayButton: HTMLButtonElement | null = null;
 // private overlayDiv: HTMLDivElement | null = null;
  private inspectorVisible: boolean = false;
  private inspectorFlowHost: HTMLDivElement;

  private eventsLog: any[];

  /**
   * Statistics about the demo, available after calling `finished()`.
   */
  public stats: {

    /**
     * 3D axis-aligned bounding box (AABB) that
     * encloses all objects in the Scene.
     */
    aabb: number[];

    /**
     * The time at which the demo initialization started.
     */
    startTime: number;

    /**
     * The time at which the demo initialization ended.
     */
    endTime: number;

    /**
     * The total time taken for demo initialization, in milliseconds.
     */
    elapsedTime: number;

    /**
     * The combined statistics of all SceneModels in the Scene.
     */
    scene: SceneModelStats;

    /**
     * Combined statistics of all DataModels in the Data.
     */
    data: DataModelStats;

    /**
     * Memory usage statistics of the WebGLRenderer.
     */
    memory: MemoryUsage;

    /**
     * Statistics about the most recently rendered frame.
     */
    renderer: RenderStats;
  };



  /**
   * Creates a DemoHelper instance.
   * @param cfg
   */
  constructor(cfg: DemoHelperConfig = {}) {
    this.makeView = cfg.makeView !== false;
    this.makeComponents = cfg.makeComponents !== false;
    this.showOverlayButton = cfg.showOverlayButton !== false;
    this.maxViews = cfg.maxViews ?? 1;
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
   * Initializes the DemoHelper by creating the Scene, Data, Viewer, WebGLRenderer, and View.
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
          //   maxBatchVertices: 25000,
          //   maxBatchIndices:  70000,
          //   maxBatchGeometries: 10000,
          //   maxBatchMeshes: 10000,
          //   maxBatchPrims:   50000
          // }

          memoryConfigs: {
            maxViews: this.maxViews ?? (cfg.maxViews ?? 1),
            tileSize: 200,
            maxTiles: 2000,
            maxBatches: 300,
            // Allow enough vertices and indices for large terrain meshes
            maxBatchVertices: 50000,
            maxBatchIndices:  70000,
            maxBatchGeometries: 10000,
            maxBatchMeshes: 10000,
            maxBatchPrims:  100000
          }
        });

        const log = (eventName: string, sender: any, args: any) => {
          //     this.eventsLog.push(`[${eventName}]`, { sender, args });
          // console.log(`%c[${eventName}]`, "color: green;", { sender, args });
          // console.log(`%c[${eventName}]`, "color: grey;", { sender, args });
          // console.log(`%c[${eventName}]`, "color: red;", { sender, args });
          // console.error(`%c[${eventName}]`, "color: red;", { sender, args });
          // console.warn(`%c[${eventName}]`, "color: orange;", { sender, args });
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

        this.aabb3Index = new SceneAABB3Index(this.scene);

        this.viewer.attachScene(this.scene);
        this.renderer.attachViewer(this.viewer);

        if (this.makeView) {
          const viewResult = this.viewer.createView({
            id: "mainView",
            elementId: "demoCanvas",
            backgroundColor: [0, 0, 0]
          });

          if (viewResult.ok === false) {
            reject(viewResult.error);
            return;
          }
          this.view = viewResult.value;
          this.cameraFlight = new CameraFlightAnimation(this.view);
          this.cameraControl = new CameraControl(this.view);
        }

        const renderInspectorResult = this.renderer.getRenderInspector();
        if (renderInspectorResult.ok !== true) {
          reject(renderInspectorResult.error);
          return;
        }
        const renderInspector = renderInspectorResult.value;
        renderInspector.enabled = true;


      //  this.builder = new DemoBuilder(this.scene, this.data);

        // @ts-ignore
        window.demoHelper = this;

        resolve({});
      } else {
        resolve({});
      }
    });
  }

  /**
   * Gets the overlay host div element.
   * Attach your examples' inspectors panels to this div.
   * @returns The HTMLDivElement for the overlay, or null if not created.
   */
  // public getOverlayHostDiv(): HTMLDivElement | null {
  //   return this.overlayDiv;
  // }

  /**
   *
   */
  public toggleInspector(): void {

   // console.log(this.eventsLog);

    if (this.inspectorVisible) {

      this.inspectorFlowHost.style.display = "none";
      this.inspectorVisible = false;
      this.view.htmlElement.style.pointerEvents = "all";

      taskRunner.unsuspend();

      return;

    } else {

      const view = this.viewer.viewList[0];

      if (!this.inspectorFlowHost) {


        this.inspectorFlowHost = FloatingPanelFlowHost.getOrCreate({
          corner: "top-right",
          marginTopPx: 65,
          zIndex: 100000,
          maxWidth: 2000,       // max width for the whole overlay area
          tileMinWidth: 800,    // per-panel min width
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

      this.inspectorFlowHost.style.display = "flex";
      if (view) {
        view.htmlElement.style.pointerEvents = "none";
      }
      this.inspectorVisible = true;

      taskRunner.suspend();
    }
  }

  /**
   * Moves the camera to fit the entire scene within the view.
   */
  public viewFit(): void {
    if (this.cameraFlight) {
      this.cameraFlight.jumpTo({
        aabb: this.aabb3Index.getSceneAABB()
      });
    }
  }

  /**
   * Orbits the camera around the scene.
   */
  public orbit(): void {
    new SDKTask({
      name: "Orbit Camera",
      repeat: true,
      stage: SDKTask.CollectInputStage,
      task: () => {
        if (this.view) {
          this.view.camera.orbitYaw(-0.5);
        }
      }
    });
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

    // if (window.location.search.includes("visualTest=true") || (window as any).xeokitVisualTest) {
    setInterval(() => {
      window.postMessage({
        type: "xeokit.visualTestJson",
        payload: {
          stats: this.stats
        }
      }, "*");
    }, 1000);

    this.signalFinished();
    // }
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
      numTextureSets: 0,
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
      combinedStats.numTextureSets += stats.numTextureSets;
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
    button.innerHTML = `<span style="vertical-align: middle;">Open Inspectors</span>`;
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
    //  button.style.opacity = "0.85";
    // button.style.transition = "background 0.2s, opacity 0.2s";
    button.onmouseenter = () => {
      button.style.background = "#ffff";
      //    button.style.opacity = "1";
    };
    button.onmouseleave = () => {
      button.style.background = "#dedede";
      //   button.style.opacity = "0.85";
    };

    // const overlay = document.createElement("div");
    // overlay.style.position = "fixed";
    // overlay.style.paddingRight = "16px";
    // overlay.style.paddingTop = "48px";
    // overlay.style.top = "0";
    // overlay.style.right = "0";
    // overlay.style.width = "100%";
    // overlay.style.height = "100%";
    // overlay.style.background = "rgba(30, 30, 40, 0.97)";
    // overlay.style.zIndex = "200000";
    // overlay.style.display = "none";
    // overlay.style.boxShadow = "2px 0 12px rgba(0,0,0,0.25)";
    // overlay.style.overflowY = "auto";
    // overlay.style.transition = "transform 0.2s";
    // overlay.style.color = "#fff";
    // overlay.style.fontFamily = "sans-serif";
    // overlay.style.backdropFilter = "blur(4px)";

    // Button click toggles overlay and caret
    button.onclick = () => {
      this.toggleInspector();
      if (this.inspectorVisible) {
        button.innerHTML = `<span style="vertical-align: middle;">Close Inspectors</span>`;
        button.classList.add("demohelper-open");
      } else {
        button.innerHTML = `<span style="vertical-align: middle;">Open Inspectors</span>`;
        button.classList.remove("demohelper-open");
      }
    };

    document.body.appendChild(button);
   // document.body.appendChild(overlay);

    this.overlayButton = button;
   // this.overlayDiv = overlay;
  }
}
