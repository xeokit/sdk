import {Component, EventEmitter} from "../core";
import {FastRender, QualityRender} from "../constants";
import type {FloatArrayParam, IntArrayParam} from "../math";
import type {Scene, SceneObject} from "../scene";
import {AmbientLight} from "./AmbientLight";
import {Camera} from "./Camera";
import {createUUID} from "../utils";
import {createVec3} from "../matrix";
import {DirLight} from "./DirLight";
import {Edges} from "./Edges";
import {EmphasisMaterial} from "./EmphasisMaterial";
import {EventDispatcher} from "strongly-typed-events";
import {LinesMaterial} from "./LinesMaterial";
import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import type {PointLight} from "./PointLight";
import {PointsMaterial} from "./PointsMaterial";
import {ResolutionScale} from "./ResolutionScale";
import {SAO} from "./SAO";
import type {SDKError} from "../core";
import {SectionPlane} from "./SectionPlane";
import type {SectionPlaneParams} from "./SectionPlaneParams";
import {type SnapshotParams} from "./SnapshotParams";
import {SnapshotResult} from "./SnapshotResult";
import {Texturing} from "./Texturing";
import type {Viewer} from "./Viewer";
import {ViewLayer} from "./ViewLayer";
import type {ViewLayerParams} from "./ViewLayerParams";
import {ViewObject} from "./ViewObject";
import type {ViewParams} from "./ViewParams";
import {ViewRendererProxy} from "./ViewRendererProxy";

/**
 * Event that signifies the beginning of a canvas snapshot captured with
 */
export interface SnapshotStartedEvent {
  width: number;
  height: number;
}

/**
 *
 */
export interface SnapshotFinishedEvent {
  width: number;
  height: number;
}

/**
 * An independent view within a {@link Viewer | Viewer}, with its own canvas, Camera and object visual states.
 *
 * See {@link viewer | @xeokit/sdk/viewer } for usage.
 */
class View extends Component {

  /**
   ID of this View, unique within the {@link Viewer | Viewer}.
   */
  declare viewId: string;

  /**
   * The Viewer to which this View belongs.
   */
  declare readonly viewer: Viewer;

  /**
   * The internal renderer interface for this View.
  * @internal
   */
  public rendererView: ViewRendererProxy;

  /**
   * The tileIndex of this View in {@link Viewer.viewList}.
   * @internal
   */
  viewIndex: number;

  /**
   * Manages the Camera for this View.
   */
  readonly camera: Camera;

  /**
   * The HTML canvas.
   */
  public htmlElement: HTMLElement;

  /**
   * Indicates if this View is transparent.
   */
  public readonly transparent: boolean;

  /**
   * Boundary of the canvas in absolute browser window coordinates.
   * Format is ````[xmin, ymin, xwidth, ywidth]````.
   */
  public readonly boundary: number[];

  /**
   * Configures Scalable Ambient Obscurance (SAO) for this View.
   */
  readonly sao: SAO;

  /**
   * Configures when textures are rendered for this View.
   */
  readonly texturing: Texturing;

  /**
   * Configures the appearance of edges belonging to {@link ViewObject} in this View.
   */
  readonly edges: Edges;

  /**
   * Configures the X-rayed appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly xrayMaterial: EmphasisMaterial;

  /**
   * Configures the highlighted appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly highlightMaterial: EmphasisMaterial;

  /**
   * Configures the appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly selectedMaterial: EmphasisMaterial;

  /**
   * Configures resolution scaling for this View.
   */
  readonly resolutionScale: ResolutionScale;

  /**
   * Configures the appearance of point primitives belonging to {@link ViewObject | ViewObjects} in this View .
   */
  readonly pointsMaterial: PointsMaterial;

  /**
   * Configures the appearance of lines belonging to {@link ViewObject | ViewObjects} in this View.
   */
  readonly linesMaterial: LinesMaterial;

  /**
   * Map of the all {@link ViewObject | ViewObjects} in this View.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   *
   * The View automatically ensures that there is a {@link ViewObject} here for
   * each {@link ViewObject} in the {@link Viewer | Viewer}
   */
  readonly objects: { [key: string]: ViewObject };

  /**
   * Map of the currently visible {@link ViewObject | ViewObjects} in this View.
   *
   * A ViewObject is visible when {@link ViewObject.visible} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly visibleObjects: { [key: string]: ViewObject };

  /**
   * Map of currently x-rayed {@link ViewObject | ViewObjects} in this View.
   *
   * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly xrayedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently highlighted {@link ViewObject | ViewObjects} in this View.
   *
   * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly highlightedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently selected {@link ViewObject | ViewObjects} in this View.
   *
   * A ViewObject is selected when {@link ViewObject.selected} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly selectedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently colorized {@link ViewObject | ViewObjects} in this View.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly colorizedObjects: { [key: string]: ViewObject };

  /**
   * Map of {@link ViewObject | ViewObjects} in this View whose opacity has been updated.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly opacityObjects: { [key: string]: ViewObject };

  /**
   * Map of {@link SectionPlane}s in this View.
   *
   * Each {@link SectionPlane} is mapped here by {@link SectionPlane.id}.
   */
  readonly sectionPlanes: { [key: string]: SectionPlane };

  /**
   * List of {@link SectionPlane}s in this View.
   */
  readonly sectionPlanesList: SectionPlane[] = [];

  /**
   * Map of light sources in this View.
   */
  readonly lights: { [key: string]: AmbientLight | PointLight | DirLight };

  /**
   * List of light sources in this View.
   */
  readonly lightsList: (AmbientLight | PointLight | DirLight)[] = [];

  gammaOutput: boolean;

  /**
   * Map of the all {@link ViewLayer}s in this View.
   *
   * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
   */
  readonly layers: { [key: string]: ViewLayer };

  /**
   * Emits an event each time the canvas boundary changes.
   *
   * @event
   */
  readonly onBoundary: EventEmitter<View, IntArrayParam>;

  /**
   * Emits an event each time a {@link ViewObject} is created in this View.
   *
   * @event
   */
  readonly onObjectCreated: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time a {@link ViewObject} is destroyed in this View.
   *
   * @event
   */
  readonly onObjectDestroyed: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the visibility of a {@link ViewObject} changes in this View.
   *
   * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
   *
   * @event
   */
  readonly onObjectVisibility: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the X-ray state of a {@link ViewObject} changes in this View.
   *
   * ViewObjects are X-rayed with {@link View.setObjectsXRayed}, {@link ViewLayer.setObjectsXRayed} or {@link ViewObject.xrayed}.
   *
   * @event
   */
  readonly onObjectXRayed: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time a {@link ViewLayer} is created in this View.
   *
   * Layers are created explicitly with {@link View.createLayer}, or implicitly with {@link scene!SceneModel.createObject | SceneModel.createObject} and {@link scene!SceneObjectParams.layerId | SceneObjectParams.layerId}.
   *
   * @event
   */
  readonly onLayerCreated: EventEmitter<View, ViewLayer>;

  /**
   * Emits an event each time a {@link ViewLayer} in this View is destroyed.
   *
   * ViewLayers are destroyed explicitly with {@link ViewLayer.destroy}, or implicitly when they become empty and {@link View.autoLayers} is false.
   *
   * @event
   */
  readonly onLayerDestroyed: EventEmitter<View, ViewLayer>;

  /**
   * Emits an event each time a {@link SectionPlane} is created in this View.
   *
   * @event
   */
  readonly onSectionPlaneCreated: EventEmitter<View, SectionPlane>;

  /**
   * Emits an event each time a {@link SectionPlane} in this View is destroyed.
   *
   * @event
   */
  readonly onSectionPlaneDestroyed: EventEmitter<View, SectionPlane>;

  /**
   * Emits an event each time a snapshot is initiated with {@link View.getSnapshot}.
   *
   * @event
   */
  readonly onSnapshotStarted: EventEmitter<View, SnapshotStartedEvent>;

  /**
   * Emits an event each time a snapshot is completed with {@link View.getSnapshot}.
   *
   * @event
   */
  readonly onSnapshotFinished: EventEmitter<View, SnapshotFinishedEvent>;

  #onTick: () => void;

  #renderMode: number = QualityRender;

  #autoLayers: boolean;
  #backgroundColor: FloatArrayParam;
  #backgroundColorFromAmbientLight: boolean;
  #numObjects: number;
  #objectIds: string[] | null;
  #numVisibleObjects: number;
  #visibleObjectIds: string[] | null;
  #numXRayedObjects: number;
  #xrayedObjectIds: string[] | null;
  #numHighlightedObjects: number;
  #highlightedObjectIds: string[] | null;
  #numSelectedObjects: number;
  #selectedObjectIds: string[] | null;
  #numColorizedObjects: number;
  #colorizedObjectIds: string[] | null;
  #numOpacityObjects: number;
  #opacityObjectIds: string[] | null;
  #lightsHash: string | null = null;
  #sectionPlanesHash: string | null = null;
  #snapshotBegun: boolean;
  #autoCanvas: boolean;


  /**
   * @private
   */
  constructor(viewer: Viewer,
              viewParams: ViewParams) {

    super(null, viewParams);

    this.viewer = viewer;

    let canvas;

    if (viewParams.htmlElement || viewParams.elementId) {
      canvas = // Canvas is actually a generic HTMLElement, but we think of it as a canvas
        viewParams.htmlElement || document.getElementById(<string>viewParams.elementId);
      if (!(canvas instanceof HTMLElement)) {
        console.error("Mandatory View config expected: valid HTMLElement");
      }
      this.#autoCanvas = false;
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.position = "absolute";
      canvas.style.zIndex = "100000";
      canvas.style.width = '600px';
      canvas.style.height = '500px';
      canvas.style.position = 'absolute';
      canvas.style.background = 'white';
      canvas.style.border = '0';
      document.body.appendChild(canvas);
      this.#autoCanvas = true;
    }

    this.htmlElement = canvas;
    this.viewIndex = 0;
    this.objects = {};
    this.visibleObjects = {};
    this.xrayedObjects = {};
    this.highlightedObjects = {};
    this.selectedObjects = {};
    this.colorizedObjects = {};
    this.opacityObjects = {};
    this.sectionPlanes = {};
    this.sectionPlanesList = [];
    this.lights = {};
    this.lightsList = [];
    this.layers = {};

    this.#numObjects = 0;
    this.#objectIds = null;
    this.#numVisibleObjects = 0;
    this.#visibleObjectIds = null;
    this.#numXRayedObjects = 0;
    this.#xrayedObjectIds = null;
    this.#numHighlightedObjects = 0;
    this.#highlightedObjectIds = null;
    this.#numSelectedObjects = 0;
    this.#selectedObjectIds = null;
    this.#numColorizedObjects = 0;
    this.#colorizedObjectIds = null;
    this.#numOpacityObjects = 0;
    this.#opacityObjectIds = null;
    this.gammaOutput = true;
    this.#snapshotBegun = false;

    this.#sectionPlanesHash = null;
    this.#lightsHash = null;

    // this.canvas = new View(this, {
    //     canvas: canvas,
    //     transparent: !!viewParams.transparent,
    //     backgroundColor: viewParams.backgroundColor,
    //     backgroundColorFromAmbientLight: !!viewParams.backgroundColorFromAmbientLight,
    //     premultipliedAlpha: !!viewParams.premultipliedAlpha
    // });
    //
    // this.canvas.onBoundary.subscribe(() => {
    //     this.needsRender();
    // });

    this.onBoundary = new EventEmitter(
      new EventDispatcher<View, IntArrayParam>()
    );

    this.#backgroundColor = createVec3([
      viewParams.backgroundColor ? viewParams.backgroundColor[0] : 1,
      viewParams.backgroundColor ? viewParams.backgroundColor[1] : 1,
      viewParams.backgroundColor ? viewParams.backgroundColor[2] : 1,
    ]);
    this.#backgroundColorFromAmbientLight =
      !!viewParams.backgroundColorFromAmbientLight;
    this.transparent = !!viewParams.transparent;
    // this.htmlElement.width = this.htmlElement.clientWidth;
    // this.htmlElement.height = this.htmlElement.clientHeight;
    this.boundary = [
      this.htmlElement.offsetLeft,
      this.htmlElement.offsetTop,
      this.htmlElement.clientWidth,
      this.htmlElement.clientHeight,
    ];

    // Publish htmlElement size and position changes on each scene tick

    let lastWindowWidth = 0;
    let lastWindowHeight = 0;
    let lastViewWidth = 0;
    let lastViewHeight = 0;
    let lastViewOffsetLeft = 0;
    let lastViewOffsetTop = 0;
    let lastParent: null | HTMLElement = null;

    const lastResolutionScale: null | number = null;

    this.#onTick = this.viewer.onTick.subscribe(() => {
      const htmlElement = this.htmlElement;
      const newResolutionScale = this.resolutionScale.resolutionScale !== lastResolutionScale;
      const newWindowSize =
        window.innerWidth !== lastWindowWidth ||
        window.innerHeight !== lastWindowHeight;
      const newViewSize =
        htmlElement.clientWidth !== lastViewWidth ||
        htmlElement.clientHeight !== lastViewHeight;
      const newViewPos =
        htmlElement.offsetLeft !== lastViewOffsetLeft ||
        htmlElement.offsetTop !== lastViewOffsetTop;
      const parent = htmlElement.parentElement;
      const newParent = parent !== lastParent;

      if (
        newResolutionScale ||
        newWindowSize ||
        newViewSize ||
        newViewPos ||
        newParent
      ) {
        //   this._spinner._adjustPosition();
        if (newResolutionScale || newViewSize || newViewPos) {
          const newWidth = htmlElement.clientWidth;
          const newHeight = htmlElement.clientHeight;
          if (newResolutionScale || newViewSize) {
            //////////////////////////////////////////////////////////////////////////////////////
            // TODO: apply resolutionscale properly
            //////////////////////////////////////////////////////////////////////////////////////
            // htmlElement.width = Math.round(
            //     htmlElement.clientWidth * this.resolutionScale.resolutionScale
            // );
            // htmlElement.height = Math.round(
            //     htmlElement.clientHeight * this.resolutionScale.resolutionScale
            // );
          }
          const boundary = this.boundary;
          boundary[0] = htmlElement.offsetLeft;
          boundary[1] = htmlElement.offsetTop;
          boundary[2] = newWidth;
          boundary[3] = newHeight;
          if (!newResolutionScale || newViewSize) {
            this.onBoundary.dispatch(this, boundary);
          }
          lastViewWidth = newWidth;
          lastViewHeight = newHeight;
        }

        if (newResolutionScale) {
          //   lastResolutionScale = this.#resolutionScale;
        }
        if (newWindowSize) {
          lastWindowWidth = window.innerWidth;
          lastWindowHeight = window.innerHeight;
        }
        if (newViewPos) {
          lastViewOffsetLeft = htmlElement.offsetLeft;
          lastViewOffsetTop = htmlElement.offsetTop;
        }
        lastParent = parent;
      }
    });

    this.camera = new Camera(this);

    this.sao = new SAO(this, viewParams.sao || {});

    this.texturing = new Texturing(this, {});

    this.xrayMaterial = new EmphasisMaterial(this, viewParams.xrayMaterial || {
      fill: true,
      fillColor: [0.9, 0.7, 0.6],
      fillAlpha: 0.4,
      edges: true,
      edgeColor: [0.5, 0.4, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.highlightMaterial = new EmphasisMaterial(this, viewParams.highlightMaterial || {
      fill: true,
      fillColor: [1.0, 1.0, 0.0],
      fillAlpha: 0.5,
      edges: true,
      edgeColor: [0.5, 0.4, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.selectedMaterial = new EmphasisMaterial(this, viewParams.selectedMaterial || {
      fill: true,
      fillColor: [0.0, 1.0, 0.0],
      fillAlpha: 0.5,
      edges: true,
      edgeColor: [0.4, 0.5, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.edges = new Edges(this, viewParams.edges || {
      edgeColor: [0.0, 0.0, 0.0],
      edgeAlpha: 1.0,
      edgeWidth: 1,
      renderModes: [QualityRender],
    });

    this.resolutionScale = new ResolutionScale(this, viewParams.resolutionScale || {
      renderModes: [FastRender],
      resolutionScale: 1.0
    });

    this.pointsMaterial = new PointsMaterial(this, viewParams.pointsMaterial || {
      pointSize: 1,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 6,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 1,
    });

    this.linesMaterial = new LinesMaterial(this, {
      lineWidth: 1,
    });

    this.lights = {};

    this.#autoLayers = viewParams.autoLayers !== false;

    this.onObjectCreated = new EventEmitter(
      new EventDispatcher<View, ViewObject>()
    );

    this.onObjectDestroyed = new EventEmitter(
      new EventDispatcher<View, ViewObject>()
    );

    this.onObjectVisibility = new EventEmitter(
      new EventDispatcher<View, ViewObject>()
    );

    this.onObjectXRayed = new EventEmitter(
      new EventDispatcher<View, ViewObject>()
    );

    this.onLayerCreated = new EventEmitter(
      new EventDispatcher<View, ViewLayer>()
    );

    this.onLayerDestroyed = new EventEmitter(
      new EventDispatcher<View, ViewLayer>()
    );

    this.onSectionPlaneCreated = new EventEmitter(
      new EventDispatcher<View, SectionPlane>()
    );

    this.onSectionPlaneDestroyed = new EventEmitter(
      new EventDispatcher<View, SectionPlane>()
    );

    this.onSnapshotStarted = new EventEmitter(
      new EventDispatcher<View, null>()
    );

    this.onSnapshotFinished = new EventEmitter(
      new EventDispatcher<View, null>()
    );

    new AmbientLight(this, {
      color: [1.0, 1.0, 1.0],
      intensity: 1.0
    });

    new DirLight(this, {
      dir: [0.8, -.5, -0.5],
      color: [0.8, 0.8, 1.0],
      intensity: 1.0,
      space: "world"
    });

    new DirLight(this, {
      dir: [-0.8, -1.0, 0.5],
      color: [1, 1, .9],
      intensity: 1.0,
      space: "world"
    });

    new DirLight(this, {
      dir: [-0.8, -1.0, -0.5],
      color: [.0, .0, 1],
      intensity: 1.0,
      space: "world"
    });

  }

  /**
   * @private
   */
  initViewObjects() {
    this.#createViewObjectsForScene();
    this.viewer.scene.onObjectCreated.subscribe((scene: Scene, sceneObject: SceneObject) => {
        this.#createViewObject(sceneObject);
      }
    );
    this.viewer.scene.onObjectDestroyed.subscribe((scene: Scene, sceneObject: SceneObject) => {
        this.#destroyViewObject(sceneObject);
      }
    );
  }

  #createViewObjectsForScene() {
    const sceneObjects = this.viewer.scene.objects;
    for (const id in sceneObjects) {
      if (!this.objects[id]) {
        this.#createViewObject(sceneObjects[id]);
      }
    }
  }

  #createViewObject(sceneObject) {
    const layerId = sceneObject.layerId || "default";
    let viewLayer = this.layers[layerId];
    if (!viewLayer) {
      if (!this.#autoLayers) {
        return;
      }
      viewLayer = new ViewLayer({
        id: layerId,
        view: this,
        viewer: this.viewer,
      });
      this.layers[layerId] = viewLayer;
      viewLayer.onDestroyed.one(() => {
        delete this.layers[viewLayer.id];
        this.onLayerDestroyed.dispatch(this, viewLayer);
      });
      this.onLayerCreated.dispatch(this, viewLayer);
    }
    if (!sceneObject.sceneObjectRendererProxy) {
      throw "Cannot create ViewObject for SceneObject that has no ViewObject: " + sceneObject.id;
    }
    const viewObject = new ViewObject(viewLayer, sceneObject);
    viewLayer.registerViewObject(viewObject);
    this.registerViewObject(viewObject);
    this.onObjectCreated.dispatch(this, viewObject);
  }

  #destroyViewObject(sceneObject) {
    const viewObject = this.objects[sceneObject.id];
    if (!viewObject) {
      return;
    }
    const layerId = sceneObject.layerId || "default";
    let viewLayer = this.layers[layerId];
    viewLayer?.deregisterViewObject(viewObject);
    this.deregisterViewObject(viewObject);
    this.onObjectDestroyed.dispatch(this, viewObject);
  }

  /**
   * Sets wether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
   * as {@link ViewObject | ViewerObjects} are created.
   *
   * When ````true```` (default), the View will automatically create {@link ViewLayer | ViewLayers} as needed for each new
   * {@link ViewObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
   * layerId. This "default" ViewLayer ensures that a ViewObject is created in the View for every SceneObject that is created.
   *
   * If you set this ````false````, however, then the View will only create {@link ViewObject | ViewObjects} for
   * {@link scene!SceneObject | SceneObjects} that have a {@link scene!SceneObject.layerId} that matches the ID of a
   * {@link ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
   *
   * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
   * ViewerObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for ViewerObjects
   * that it never needs to show.
   *
   * Default value is `true``.
   *
   * @param autoLayers The new value for atuoLayers
   */
  set autoLayers(autoLayers: boolean) {
    if (this.#autoLayers === autoLayers) {
      return;
    }
    this.#autoLayers = autoLayers;
    if (autoLayers) {
      this.#createViewObjectsForScene();
    }
  }

  /**
   * Gets whether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
   * as {@link ViewObject | ViewerObjects} are created.
   */
  get autoLayers(): boolean {
    return this.#autoLayers;
  }

  /**
   * Sets which rendering mode this View is in.
   *
   * Default value is {@link constants!QualityRender | QualityRender}.
   *
   * Setting a View's rendering mode will activate whatever effects (eg. SAO, edges, canas scaling) are configured to
   * be active in that mode, while deactivating all other effects.
   */
  set renderMode(renderMode: number) {
    this.#renderMode = renderMode;
    this.needsRender();
  }

  /**
   * Gets which rendering mode this View is in.
   *
   * Default value is {@link constants!QualityRender | QualityRender}.
   */
  get renderMode(): number {
    return this.#renderMode;
  }

  /**
   * Gets the canvas clear color.
   *
   * Default value is ````[1, 1, 1]````.
   */
  get backgroundColor(): FloatArrayParam {
    return this.#backgroundColor;
  }

  /**
   * Sets the canvas clear color.
   *
   * Default value is ````[1, 1, 1]````.
   */
  set backgroundColor(value: FloatArrayParam) {
    if (value) {
      this.#backgroundColor[0] = value[0];
      this.#backgroundColor[1] = value[1];
      this.#backgroundColor[2] = value[2];
    } else {
      this.#backgroundColor[0] = 1.0;
      this.#backgroundColor[1] = 1.0;
      this.#backgroundColor[2] = 1.0;
    }
    this.needsRender();
  }

  /**
   * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link View#backgroundColor}
   * when {@link View#transparent} is ```true```.
   *
   * When {@link View#transparent} is ```true``` and this is ````true````, then the canvas clear color will
   * be taken from the ambient light color.
   *
   * When {@link View#transparent} is ```true``` and this is ````false````, then the canvas clear color will
   * be taken from {@link View#backgroundColor}.
   *
   * Default value is ````true````.
   */
  get backgroundColorFromAmbientLight(): boolean {
    return this.#backgroundColorFromAmbientLight;
  }

  /**
   * Sets if the canvas background color is derived from an {@link AmbientLight}.
   *
   * This only has effect when the canvas is not transparent. When not enabled, the background color
   * will be the canvas element's HTML/CSS background color.
   *
   * Default value is ````true````.
   */
  set backgroundColorFromAmbientLight(
    backgroundColorFromAmbientLight: boolean
  ) {
    this.#backgroundColorFromAmbientLight =
      backgroundColorFromAmbientLight !== false;
  }

  /**
   * Gets the gamma factor.
   */
  get gammaFactor() {
    // TODO
    return 1.0;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this View.
   */
  get numObjects(): number {
    return this.#numObjects;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this View.
   */
  get objectIds(): string[] {
    if (!this.#objectIds) {
      this.#objectIds = Object.keys(this.objects);
    }
    return this.#objectIds;
  }

  /**
   * Gets the number of visible {@link ViewObject | ViewObjects} in this View.
   */
  get numVisibleObjects(): number {
    return this.#numVisibleObjects;
  }

  /**
   * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this View.
   */
  get visibleObjectIds(): string[] {
    if (!this.#visibleObjectIds) {
      this.#visibleObjectIds = Object.keys(this.visibleObjects);
    }
    return this.#visibleObjectIds;
  }

  /**
   * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this View.
   */
  get numXRayedObjects(): number {
    return this.#numXRayedObjects;
  }

  /**
   * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this View.
   */
  get xrayedObjectIds(): string[] {
    if (!this.#xrayedObjectIds) {
      this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
    }
    return this.#xrayedObjectIds;
  }

  /**
   * Gets the number of highlighted {@link ViewObject | ViewObjects} in this View.
   */
  get numHighlightedObjects(): number {
    return this.#numHighlightedObjects;
  }

  /**
   * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this View.
   */
  get highlightedObjectIds(): string[] {
    if (!this.#highlightedObjectIds) {
      this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
    }
    return this.#highlightedObjectIds;
  }

  /**
   * Gets the number of selected {@link ViewObject | ViewObjects} in this View.
   */
  get numSelectedObjects(): number {
    return this.#numSelectedObjects;
  }

  /**
   * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this View.
   */
  get selectedObjectIds(): string[] {
    if (!this.#selectedObjectIds) {
      this.#selectedObjectIds = Object.keys(this.selectedObjects);
    }
    return this.#selectedObjectIds;
  }

  /**
   * Gets the number of colorized {@link ViewObject | ViewObjects} in this View.
   */
  get numColorizedObjects(): number {
    return this.#numColorizedObjects;
  }

  /**
   * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this View.
   */
  get colorizedObjectIds(): string[] {
    if (!this.#colorizedObjectIds) {
      this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
    }
    return this.#colorizedObjectIds;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this View that have updated opacities.
   */
  get opacityObjectIds(): string[] {
    if (!this.#opacityObjectIds) {
      this.#opacityObjectIds = Object.keys(this.opacityObjects);
    }
    return this.#opacityObjectIds;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this View that have updated opacities.
   */
  get numOpacityObjects(): number {
    return this.#numOpacityObjects;
  }

  /**
   * @private
   */
  registerViewObject(viewObject: ViewObject) {
    this.objects[viewObject.id] = viewObject;
    this.#numObjects++;
    this.#objectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  deregisterViewObject(viewObject: ViewObject) {
    delete this.objects[viewObject.id];
    delete this.visibleObjects[viewObject.id];
    delete this.xrayedObjects[viewObject.id];
    delete this.highlightedObjects[viewObject.id];
    delete this.selectedObjects[viewObject.id];
    delete this.colorizedObjects[viewObject.id];
    delete this.opacityObjects[viewObject.id];
    this.#numObjects--;
    this.#objectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  objectVisibilityUpdated(
    viewObject: ViewObject,
    visible: boolean,
    notify: boolean = true
  ) {
    if (visible) {
      this.visibleObjects[viewObject.id] = viewObject;
      this.#numVisibleObjects++;
    } else {
      delete this.visibleObjects[viewObject.id];
      this.#numVisibleObjects--;
    }
    this.#visibleObjectIds = null; // Lazy regenerate
    if (notify) {
      this.onObjectVisibility.dispatch(this, viewObject);
    }
  }

  /**
   * @private
   */
  objectXRayedUpdated(
    viewObject: ViewObject,
    xrayed: boolean,
    notify: boolean = true
  ) {
    if (xrayed) {
      this.xrayedObjects[viewObject.id] = viewObject;
      this.#numXRayedObjects++;
    } else {
      delete this.xrayedObjects[viewObject.id];
      this.#numXRayedObjects--;
    }
    this.#xrayedObjectIds = null; // Lazy regenerate
    if (notify) {
      this.onObjectXRayed.dispatch(this, viewObject);
    }
  }

  /**
   * @private
   */
  objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean) {
    if (highlighted) {
      this.highlightedObjects[viewObject.id] = viewObject;
      this.#numHighlightedObjects++;
    } else {
      delete this.highlightedObjects[viewObject.id];
      this.#numHighlightedObjects--;
    }
    this.#highlightedObjectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  objectSelectedUpdated(viewObject: ViewObject, selected: boolean) {
    if (selected) {
      this.selectedObjects[viewObject.id] = viewObject;
      this.#numSelectedObjects++;
    } else {
      delete this.selectedObjects[viewObject.id];
      this.#numSelectedObjects--;
    }
    this.#selectedObjectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
    if (colorized) {
      this.colorizedObjects[viewObject.id] = viewObject;
      this.#numColorizedObjects++;
    } else {
      delete this.colorizedObjects[viewObject.id];
      this.#numColorizedObjects--;
    }
    this.#colorizedObjectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
    if (opacityUpdated) {
      this.opacityObjects[viewObject.id] = viewObject;
      this.#numOpacityObjects++;
    } else {
      delete this.opacityObjects[viewObject.id];
      this.#numOpacityObjects--;
    }
    this.#opacityObjectIds = null; // Lazy regenerate
  }

  /**
   * Creates a {@link SectionPlane} in this View.
   *
   * @param sectionPlaneParams
   */
  createSectionPlane(sectionPlaneParams: SectionPlaneParams): SectionPlane {
    let id = sectionPlaneParams.id || createUUID();
    if (this.sectionPlanes[id]) {
      this.error(
        `SectionPlane with ID "${id}" already exists - will randomly-generate ID`
      );
      id = createUUID();
    }
    const sectionPlane = new SectionPlane(this, sectionPlaneParams);
    this.#registerSectionPlane(sectionPlane);
    sectionPlane.onDestroyed.one(() => {
      this.#deregisterSectionPlane(sectionPlane);
    });
    return sectionPlane;
  }

  /**
   * Destroys the {@link SectionPlane | SectionPlanes} in this View.
   */
  clearSectionPlanes(): void {
    const objectIds = Object.keys(this.sectionPlanes);
    for (let i = 0, len = objectIds.length; i < len; i++) {
      this.sectionPlanes[objectIds[i]].destroy();
    }
    this.sectionPlanesList.length = 0;
    this.#sectionPlanesHash = null;
  }

  /**
   * @private
   */
  getSectionPlanesHash() {
    if (this.#sectionPlanesHash) {
      return this.#sectionPlanesHash;
    }
    if (this.sectionPlanesList.length === 0) {
      return (this.#sectionPlanesHash = ";");
    }
    let sectionPlane;
    const hashParts = [];
    for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
      sectionPlane = this.sectionPlanesList[i];
      hashParts.push("cp");
    }
    hashParts.push(";");
    this.#sectionPlanesHash = hashParts.join("");
    return this.#sectionPlanesHash;
  }

  /**
   * @private
   */
  registerLight(light: PointLight | DirLight | AmbientLight) {
    this.lightsList.push(light);
    this.lights[light.id] = light;
    this.#lightsHash = null;
    this.rebuild();
  }

  /**
   * @private
   */
  deregisterLight(light: PointLight | DirLight | AmbientLight) {
    for (let i = 0, len = this.lightsList.length; i < len; i++) {
      if (this.lightsList[i].id === light.id) {
        this.lightsList.splice(i, 1);
        this.#lightsHash = null;
        delete this.lights[light.id];
        this.rebuild();
        return;
      }
    }
  }

  /**
   * Destroys the {@link DirLight | DirLights}, {@link PointLight | PointLights} and {@link AmbientLight | AmbientLights} in this View.
   */
  clearLights(): void {
    const lightIds = Object.keys(this.lights);
    for (let i = 0, len = lightIds.length; i < len; i++) {
      this.lights[lightIds[i]].destroy();
    }
  }

  /**
   * @private
   */
  getLightsHash() {
    if (this.#lightsHash) {
      return this.#lightsHash;
    }
    if (this.lightsList.length === 0) {
      return (this.#lightsHash = ";");
    }
    const hashParts = [];
    const lights = this.lightsList;
    for (let i = 0, len = lights.length; i < len; i++) {
      const light: any = lights[i];
      hashParts.push("/");
      hashParts.push(light instanceof DirLight ? "d" : "p");
      hashParts.push(light.space === "world" ? "w" : "v");
      if (light.castsShadow) {
        hashParts.push("sh");
      }
    }
    // if (this.lightMaps.length > 0) {
    //     hashParts.push("/lm");
    // }
    // if (this.reflectionMaps.length > 0) {
    //     hashParts.push("/rm");
    // }
    hashParts.push(";");
    this.#lightsHash = hashParts.join("");
    return this.#lightsHash;
  }

  /**
   * @private
   */
  rebuild() {

  }

  /**
   * @private
   */
  needsRender() {
    this.rendererView?.needsRender();
  }

  /**
   * @private
   */
  getAmbientColorAndIntensity(): FloatArrayParam {
    return [0.5, 0.5, 0.5, 1];
  }

  /**
   * Updates the visibility of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
   * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
   *
   * @param {string[]} objectIds Array of {@link ViewObject.id} values.
   * @param visible Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsVisible(objectIds: string[], visible: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.visible !== visible;
      viewObject.visible = visible;
      return changed;
    });
  }

  /**
   * Updates the collidability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
   *
   * @param {string[]} objectIds Array of {@link ViewObject.id} values.
   * @param collidable Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsCollidable(objectIds: string[], collidable: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.collidable !== collidable;
      viewObject.collidable = collidable;
      return changed;
    });
  }

  /**
   * Updates the culled status of the given {@link ViewObject | ViewObjects} in this View.
   *
   * Updates {@link ViewObject.culled} on the Objects with the given IDs.
   *
   * @param {string[]} objectIds Array of {@link ViewObject.id} values.
   * @param culled Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsCulled(objectIds: string[], culled: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.culled !== culled;
      viewObject.culled = culled;
      return changed;
    });
  }

  /**
   * Selects or deselects the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
   * - Updates {@link View.selectedObjects} and {@link View.numSelectedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param selected Whether or not to select.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsSelected(objectIds: string[], selected: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.selected !== selected;
      viewObject.selected = selected;
      return changed;
    });
  }

  /**
   * Highlights or un-highlights the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
   * - Updates {@link View.highlightedObjects} and {@link View.numHighlightedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param highlighted Whether or not to highlight.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsHighlighted(objectIds: string[], highlighted: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.highlighted !== highlighted;
      viewObject.highlighted = highlighted;
      return changed;
    });
  }

  /**
   * Applies or removes X-ray rendering for the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
   * - Updates {@link View.xrayedObjects} and {@link View.numXRayedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param xrayed Whether or not to xray.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsXRayed(objectIds: string[], xrayed: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.xrayed !== xrayed;
      if (changed) {
        viewObject.xrayed = xrayed;
      }
      return changed;
    });
  }

  /**
   * Colorizes the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
   * - Updates {@link View.colorizedObjects} and {@link View.numColorizedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */
  setObjectsColorized(objectIds: string[], colorize: number[]) {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      viewObject.colorize = colorize;
    });
  }

  /**
   * Sets the opacity of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
   * - Updates {@link View.opacityObjects} and {@link View.numOpacityObjects}.
   *
   * @param  objectIds - One or more {@link ViewObject.id} values.
   * @param opacity - Opacity factor in range ````[0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */
  setObjectsOpacity(objectIds: string[], opacity: number): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.opacity !== opacity;
      if (changed) {
        viewObject.opacity = opacity;
      }
      return changed;
    });
  }

  /**
   * Sets the pickability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
   *
   * @param {string[]} objectIds Array of {@link ViewObject.id} values.
   * @param pickable Whether or not to set pickable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsPickable(objectIds: string[], pickable: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.pickable !== pickable;
      if (changed) {
        viewObject.pickable = pickable;
      }
      return changed;
    });
  }

  /**
   * Sets the clippability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
   * - Enables or disables the ability to clip the given Objects with {@link SectionPlane}.
   *
   * @param objectIds Array of {@link ViewObject.id} values.
   * @param clippable Whether or not to set clippable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsClippable(objectIds: string[], clippable: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = viewObject.clippable !== clippable;
      if (changed) {
        viewObject.clippable = clippable;
      }
      return changed;
    });
  }

  /**
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this View.
   *
   * @param objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link ViewObject}.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  withObjects(objectIds: string[], callback: Function): boolean {
    let changed = false;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const id = objectIds[i];
      const viewObject = this.objects[id];
      if (viewObject) {
        changed = callback(viewObject) || changed;
      }
    }
    return changed;
  }

  /**
   * Creates a {@link ViewLayer} in this View.
   *
   * The ViewLayer is then registered in {@link View.layers}.
   *
   * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link ViewLayer.destroy}
   * is called, or the {@link View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
   * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
   *
   * @param viewLayerParams
   * @returns The new ViewLayer
   */
  createLayer(viewLayerParams: ViewLayerParams): ViewLayer {
    let viewLayer = this.layers[viewLayerParams.id];
    if (!viewLayer) {
      viewLayer = new ViewLayer({
        // Automatically creates ViewObjects
        id: viewLayerParams.id,
        view: this,
        viewer: this.viewer,
      });
      this.layers[viewLayerParams.id] = viewLayer;
      this.onLayerCreated.dispatch(this, viewLayer);
      viewLayer.onDestroyed.one(() => {
        delete this.layers[viewLayer.id];
        this.onLayerDestroyed.dispatch(this, viewLayer);
      });
    }
    viewLayer.autoDestroy = viewLayerParams.autoDestroy || false;
    return viewLayer;
  }

  /**
   * Attempts to pick a ViewObject in this View.
   *
   * @param pickParams Picking parameters.
   * @param pickResult Picking results, when caller wants to manage them externally.
   * @throws {@link core!SDKError | SDKError}
   * * No View is currently attached to this Renderer.
   * * Can't find a View attached to this Renderer with the given handle.
   * * Illegal picking parameters given.
   * @returns {Boolean}
   * * Picking attempt completed.
   */
  pick(pickParams: PickParams, pickResult?: PickResult): boolean | null | SDKError {
    return this.rendererView.pick(pickParams, pickResult);
  }

  /**
   * Enter snapshot mode.
   *
   * Switches rendering to a hidden snapshot canvas.
   *
   * Exit snapshot mode using {@link viewer!Viewer.endSnapshot | Viewer.endSnapshot}.
   */
  beginSnapshot() {
    if (this.#snapshotBegun) {
      return;
    }
    this.rendererView?.beginSnapshot();
   // this.viewer.renderer.beginSnapshot(this.viewIndex);
    this.#snapshotBegun = true;
  }

  /**
   * Captures a snapshot image of this View.
   *
   * @param snapshotParams
   * @param snapshotResult
   */
  getSnapshot(snapshotParams: SnapshotParams, snapshotResult?: SnapshotResult): SnapshotResult {
    // const needFinishSnapshot = (!this.#snapshotBegun);
    // const resize = (snapshotParams.width !== undefined && snapshotParams.height !== undefined);
    // const canvas = this.htmlElement;
    // const saveWidth = canvas.clientWidth;
    // const saveHeight = canvas.clientHeight;
    // const width = snapshotParams.width ? Math.floor(snapshotParams.width) : canvas.width;
    // const height = snapshotParams.height ? Math.floor(snapshotParams.height) : canvas.height;
    //
    // if (resize) {
    //     // canvas.width = width;
    //     // canvas.height = height;
    // }
    //
    // if (!this.#snapshotBegun) {
    //     this.onSnapshotStarted.dispatch(this, {
    //         width,
    //         height
    //     });
    // }

    // if (!snapshotParams.includeGizmos) {
    //     this.sendToPlugins("snapshotStarting"); // Tells plugins to hide things that shouldn't be in snapshot
    // }
    //
    // const captured = {};
    // for (let i = 0, len = this._plugins.length; i < len; i++) {
    //     const plugin = this._plugins[i];
    //     if (plugin.getContainerElement) {
    //         const container = plugin.getContainerElement();
    //         if (container !== document.body) {
    //             if (!captured[container.id]) {
    //                 captured[container.id] = true;
    //                 html2canvas(container).then(function (canvas) {
    //                     document.body.appendChild(canvas);
    //                 });
    //             }
    //         }
    //     }
    // }
    //
    // this.scene._renderer.renderSnapshot();
    //
    // const imageDataURI = this.scene._renderer.readSnapshot(snapshotParams);
    //
    // if (resize) {
    //     canvas.width = saveWidth;
    //     canvas.height = saveHeight;
    //
    //     this.scene.glRedraw();
    // }
    //
    // if (!snapshotParams.includeGizmos) {
    //     this.sendToPlugins("snapshotFinished");
    // }
    //
    // if (needFinishSnapshot) {
    //     this.endSnapshot();
    // }

    //    return imageDataURI;
    return new SnapshotResult();
  }

  #registerSectionPlane(sectionPlane: SectionPlane) {
    this.sectionPlanesList.push(sectionPlane);
    this.sectionPlanes[sectionPlane.id] = sectionPlane;
    this.#sectionPlanesHash = null;
    this.rebuild();
    this.onSectionPlaneCreated.dispatch(this, sectionPlane);
  }

  #deregisterSectionPlane(sectionPlane: SectionPlane) {
    for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
      if (this.sectionPlanesList[i].id === sectionPlane.id) {
        this.sectionPlanesList.splice(i, 1);
        this.#sectionPlanesHash = null;
        delete this.sectionPlanes[sectionPlane.id];
        this.rebuild();
        this.onSectionPlaneDestroyed.dispatch(this, sectionPlane);
        return;
      }
    }
  }

  getNumAllocatedSectionPlanes(): number {
    return this.sectionPlanesList.length;
  }

  /**
   * Sets the state of this View.
   * @param viewParams
   */
  fromParams(viewParams: ViewParams) {
    if (viewParams.camera) {
      this.camera.fromParams(viewParams.camera);
    }
    this.autoLayers = viewParams.autoLayers;
    if (viewParams.layers) {
      for (const viewLayerParams of viewParams.layers) {
        const existingViewLayer = this.layers[viewLayerParams.id];
        if (!existingViewLayer) {
          this.createLayer(viewLayerParams);
        }
      }
    }
    if (viewParams.sectionPlanes) {
      for (const sectionPlaneParams of viewParams.sectionPlanes) {
        const existingSectionPlane = this.sectionPlanes[sectionPlaneParams.id];
        if (existingSectionPlane) {
          existingSectionPlane.fromParams(sectionPlaneParams);
        } else {
          this.createSectionPlane(sectionPlaneParams);
        }
      }
    }
    if (viewParams.sao) {
      this.sao.fromParams(viewParams.sao);
    }
    if (viewParams.edges) {
      this.edges.fromParams(viewParams.edges);
    }
    if (viewParams.highlightMaterial) {
      this.highlightMaterial.fromParams(viewParams.highlightMaterial);
    }
    if (viewParams.selectedMaterial) {
      this.selectedMaterial.fromParams(viewParams.selectedMaterial);
    }
    if (viewParams.xrayMaterial) {
      this.xrayMaterial.fromParams(viewParams.xrayMaterial);
    }
    if (viewParams.pointsMaterial) {
      this.pointsMaterial.fromParams(viewParams.pointsMaterial);
    }
    // TODO: Update lights
  }

  /**
   * Gets this View as JSON.
   */
  toParams(): ViewParams {
    return {
      id: this.id,
      camera: this.camera.toParams(),
      autoLayers: this.autoLayers,
      layers: Object.values(this.layers).map(viewLayer => viewLayer.toParams()),
      sectionPlanes: Object.values(this.sectionPlanes).map(sectionPlane => sectionPlane.toParams()),
      lights: Object.values(this.lights).map(light => light.toParams()),
      sao: this.sao.toParams(),
      edges: this.edges.toParams(),
      highlightMaterial: this.highlightMaterial.toParams(),
      selectedMaterial: this.selectedMaterial.toParams(),
      xrayMaterial: this.xrayMaterial.toParams(),
      pointsMaterial: this.pointsMaterial.toParams(),
      resolutionScale: this.resolutionScale.toParams(),
      renderMode: this.renderMode
    };
  }

  /**
   * Destroys this View.
   *
   * Causes {@link Viewer | Viewer} to fire a "viewDestroyed" event.
   */
  destroy() {
    this.viewer.onTick.unsubscribe(this.#onTick);
    this.#destroyViewLayers();
    this.#destroyViewObjects();
    this.onObjectCreated.clear();
    this.onObjectDestroyed.clear();
    this.onObjectVisibility.clear();
    this.onObjectXRayed.clear();
    this.onLayerCreated.clear();
    this.onLayerDestroyed.clear();
    this.onSectionPlaneCreated.clear();
    this.onSectionPlaneDestroyed.clear();
    super.destroy();
  }

  #destroyViewLayers() {
    const layers = this.layers;
    for (const id in layers) {
      const viewLayer = layers[id];
      viewLayer.destroy();
    }
  }

  #destroyViewObjects() {
    const objects = this.objects;
    for (const id in objects) {
      const object = objects[id];
      const sceneObject = object.sceneObject;
      const layerId = sceneObject.layerId || "default";
      const viewLayer = this.layers[layerId];
      const viewObject = this.objects[object.id];
      this.deregisterViewObject(viewObject);
      if (viewLayer) {
        viewLayer.deregisterViewObject(viewObject);
        if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
          viewLayer.destroy();
        }
      }
      this.onObjectDestroyed.dispatch(this, viewObject);
    }
  }
}

export {View};
