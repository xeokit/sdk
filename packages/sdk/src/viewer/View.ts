import {EventEmitter, SDKErrorType, SDKInternalException, type SDKResult, SDKTask,} from "../core";
import {DetailedRender, NavigationRender, RealisticRender} from "../constants";
import type {FloatArrayParam} from "../math";
import type { Vec3} from "../math/vector";
import type {SceneObject} from "../scene";
import {AmbientLight} from "./AmbientLight";
import {Camera} from "./Camera";
import {createUUID} from "../utils";
import {createVec3Float64} from "../math/vector";
import {DirLight} from "./DirLight";
import {Effect} from "./Effect";
import {LinesMaterial} from "./LinesMaterial";
import type {PointLight} from "./PointLight";
import {PointsMaterial} from "./PointsMaterial";
import {ResolutionScale} from "./ResolutionScale";
import {Effects} from "./Effects";
import {Lights} from "./Lights";
import {SectionPlane} from "./SectionPlane";
import type {SectionPlaneParams} from "./SectionPlaneParams";
import {Texturing} from "./Texturing";
import type {Viewer} from "./Viewer";
import {ViewLayer} from "./ViewLayer";
import type {ViewLayerParams} from "./ViewLayerParams";
import {ViewObject} from "./ViewObject";
import type {ViewParams} from "./ViewParams";
import {EventDispatcher} from "strongly-typed-events";
import type {CameraParams} from "./CameraParams";
import type {SAOParams} from "./SAOParams";
import type {ShadowsParams} from "./ShadowsParams";
import type {TonemapParams} from "./TonemapParams";
import type {AntiAliasingParams} from "./AntiAliasingParams";
import type {BloomParams} from "./BloomParams";
import type {EdgesParams} from "./EdgesParams";
import type {EffectParams} from "./EffectParams";
import type {PointsMaterialParams} from "./PointsMaterialParams";
import type {ResolutionScaleParams} from "./ResolutionScaleParams";
import {ViewTransformParams} from "./ViewTransformParams";
import {ViewTransform} from "./ViewTransform";

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
class View {

  /**
   ID of this View, unique within the {@link Viewer | Viewer}.
   */
  public readonly id: string;

  /**
   * The Viewer to which this View belongs.
   */
  public readonly viewer: Viewer;

  /**
   * The tileIndex of this View in {@link Viewer.viewList}.
   * @internal
   */
  public viewIndex: number;

  /**
   * Manages the Camera for this View.
   */
  public readonly camera: Camera;

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
   * Aggregates the renderer-effect components for this View — SAO,
   * Edges, Bloom, Tonemap, AntiAliasing, and Shadows. Reach the
   * individual effects through {@link Effects.sao},
   * {@link Effects.edges}, {@link Effects.bloom},
   * {@link Effects.tonemap}, {@link Effects.antiAliasing}, and
   * {@link Effects.shadows}.
   */
  public readonly effects: Effects;

  /**
   * Aggregates the environment-illumination components for this View
   * — cubemap {@link IBL} at {@link Lights.ibl}, plus the analytical
   * {@link HemisphereAmbient | hemispheric ambient} at
   * {@link Lights.hemispheric}.
   */
  public readonly lights: Lights;

  /**
   * Configures when textures are rendered for this View.
   */
  public readonly texturing: Texturing;

  /**
   * Configures the X-rayed appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly xrayMaterial: Effect;

  /**
   * Configures the highlighted appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly highlightMaterial: Effect;

  /**
   * Configures the appearance of {@link ViewObject | ViewObjects} in this View.
   */
  readonly selectedMaterial: Effect;

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
   * Id-keyed registry of legacy {@link AmbientLight} / {@link PointLight} /
   * {@link DirLight} instances attached to this View. Populated by the
   * light constructors via {@link View.registerLight}.
   *
   * @internal
   */
  readonly lightSources: { [key: string]: AmbientLight | PointLight | DirLight };

  /**
   * List of legacy light sources in this View, in registration order.
   *
   * @internal
   */
  readonly lightsList: (AmbientLight | PointLight | DirLight)[] = [];

  gammaOutput: boolean;

  /**
   * Set of {@link ViewTransform}s in this View.
   */
  readonly transforms: { [key: string]: ViewTransform };

  /**
   * Map of the all {@link ViewLayer}s in this View.
   *
   * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
   */
  readonly layers: { [key: string]: ViewLayer };

  /**
   * Emits an event each time the canvas boundary changes.
   *
   * @private
   */
  readonly onBoundary: EventEmitter<View, FloatArrayParam>;

  /**
   * True if this View has been destroyed.
   */
  public destroyed: boolean = false;

  private _renderMode: number = DetailedRender;
  private _autoLayers: boolean;
  private _backgroundColor: FloatArrayParam;
  private _backgroundColorFromAmbientLight: boolean;
  private _numObjects: number;
  private _objectIds: string[] | null;
  private _numVisibleObjects: number;
  private _visibleObjectIds: string[] | null;
  private _numXRayedObjects: number;
  private _xrayedObjectIds: string[] | null;
  private _numHighlightedObjects: number;
  private _highlightedObjectIds: string[] | null;
  private _numSelectedObjects: number;
  private _selectedObjectIds: string[] | null;
  private _numColorizedObjects: number;
  private _colorizedObjectIds: string[] | null;
  private _numOpacityObjects: number;
  private _opacityObjectIds: string[] | null;
  private _lightsHash: string | null = null;
  private _sectionPlanesHash: string | null = null;
  private _snapshotBegun: boolean;
  private _autoCanvas: boolean;
  private _needsRender: boolean;
  private _resizeObserver: ResizeObserver | null = null;
  private _windowResizeListener: (() => void) | null = null;
  private _fireViewUpdatedEventTask: SDKTask;

  /**
   * @private
   */
  constructor(viewer: Viewer, viewParams: ViewParams) {

    this.id = viewParams.id || createUUID();
    this.viewer = viewer;

    let canvas;

    if (viewParams.htmlElement || viewParams.elementId) {
      canvas = // Canvas is actually a generic HTMLElement, but we think of it as a canvas
          viewParams.htmlElement || document.getElementById(<string>viewParams.elementId);
      if (!(canvas instanceof HTMLElement)) {
        throw new SDKInternalException("[View.constructor] Mandatory View config expected: valid HTMLElement");
      }
      this._autoCanvas = false;
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
      this._autoCanvas = true;
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
    this.lightSources = {};
    this.lightsList = [];
    this.layers = {};
    this.transforms = {};

    this._renderMode = viewParams.renderMode !== undefined ? viewParams.renderMode : DetailedRender;
    this._numObjects = 0;
    this._objectIds = null;
    this._numVisibleObjects = 0;
    this._visibleObjectIds = null;
    this._numXRayedObjects = 0;
    this._xrayedObjectIds = null;
    this._numHighlightedObjects = 0;
    this._highlightedObjectIds = null;
    this._numSelectedObjects = 0;
    this._selectedObjectIds = null;
    this._numColorizedObjects = 0;
    this._colorizedObjectIds = null;
    this._numOpacityObjects = 0;
    this._opacityObjectIds = null;
    this.gammaOutput = true;
    this._snapshotBegun = false;
    this._needsRender = false;

    this._sectionPlanesHash = null;
    this._lightsHash = null;

    // this.canvas = new View(this, {
    //     canvas: canvas,
    //     transparent: !!viewParams.transparent,
    //     backgroundColor: viewParams.backgroundColor,
    //     backgroundColorFromAmbientLight: !!viewParams.backgroundColorFromAmbientLight,
    //     premultipliedAlpha: !!viewParams.premultipliedAlpha
    // });
    //
    // this.canvas.viewCanvasBoundary.subscribe(() => {
    //     this.needsRender();
    // });

    // this.viewCanvasBoundary = new EventEmitter(
    //   new EventDispatcher<View, IntArrayParam>()
    // );

    this._backgroundColor = createVec3Float64([
      viewParams.backgroundColor ? viewParams.backgroundColor[0] : 1,
      viewParams.backgroundColor ? viewParams.backgroundColor[1] : 1,
      viewParams.backgroundColor ? viewParams.backgroundColor[2] : 1,
    ]);
    this._backgroundColorFromAmbientLight =
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

    this.camera = new Camera(this, viewParams.camera || {});

    this.effects = new Effects(this, viewParams.effects || {});

    this.lights = new Lights(this, viewParams.lights || {});

    this.texturing = new Texturing(this, {});

    this.xrayMaterial = new Effect(this, viewParams.xrayMaterial || {
      // Conventional "x-ray ghost" — cool pale-blue body, translucent enough
      // to see through but solid enough not to wash out, with fully-opaque
      // dark edges so silhouettes read clearly through stacked geometry.
      fill: true,
      fillColor: [0.85, 0.9, 1.0],
      fillAlpha: 0.35,
      edges: true,
      edgeColor: [0.1, 0.15, 0.25],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.highlightMaterial = new Effect(this, viewParams.highlightMaterial || {
      // Warm amber "hover" — less harsh than pure yellow, with a darker
      // same-hue edge so the silhouette reads on any background.
      fill: true,
      fillColor: [1.0, 0.78, 0.25],
      fillAlpha: 0.4,
      edges: true,
      edgeColor: [0.55, 0.35, 0.05],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.selectedMaterial = new Effect(this, viewParams.selectedMaterial || {
      // Cool teal "committed" — pairs with the warm highlight (warm = hot/
      // hovered, cool = locked-in). Darker teal edge for clean silhouettes.
      fill: true,
      fillColor: [0.1, 0.7, 1.0],
      fillAlpha: 0.4,
      edges: true,
      edgeColor: [0.05, 0.3, 0.55],
      edgeAlpha: 1.0,
      edgeWidth: 1,
    });

    this.resolutionScale = new ResolutionScale(this, viewParams.resolutionScale || {
      renderModes: [NavigationRender],
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

    this._autoLayers = viewParams.autoLayers !== false;

    if (viewParams.layers) {
      for (const viewLayerParams of viewParams.layers) {
        const existingViewLayer = this.layers[viewLayerParams.id];
        if (!existingViewLayer) {
          this.createLayer(viewLayerParams);
        }
      }
    }

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

    this.onBoundary = new EventEmitter(new EventDispatcher<View, FloatArrayParam>());

    // Publish htmlElement size and position changes via ResizeObserver and window resize.
    // ResizeObserver fires when the element's content box changes size.
    // window 'resize' catches position-only changes (element moved when window resizes).

    const updateBoundary = () => {
      const el = this.htmlElement;
      const newLeft = el.offsetLeft;
      const newTop = el.offsetTop;
      const newWidth = el.clientWidth;
      const newHeight = el.clientHeight;
      const b = this.boundary;
      if (newLeft !== b[0] || newTop !== b[1] || newWidth !== b[2] || newHeight !== b[3]) {
        b[0] = newLeft;
        b[1] = newTop;
        b[2] = newWidth;
        b[3] = newHeight;
        this.onBoundary.dispatch(this, b);
        this.viewer.events.onViewCanvasBoundaryChanged.dispatch(this, b);
      }
    };

    this._resizeObserver = new ResizeObserver(() => updateBoundary());
    this._resizeObserver.observe(this.htmlElement);

    this._windowResizeListener = updateBoundary;
    window.addEventListener('resize', this._windowResizeListener);

    this._fireViewUpdatedEventTask = new SDKTask({
      name: "View._fireViewUpdatedEventTask",
      task: () => {
        if (this._needsRender) {
          this.viewer.events.onViewUpdated.dispatch(this, this);
          this._needsRender = false;
        }
      },
      stage: SDKTask.RenderStage
    });
  }

  /**
   * @private
   */
  _attachSceneObject(sceneObject: SceneObject) {
    const objectId = sceneObject.id;
    if (this.objects[objectId]) {
      return;
    }

    const layerId = sceneObject.layerId || "default";
    let viewLayer = this.layers[layerId];
    if (!viewLayer) {
      if (!this._autoLayers) {
        return;
      }
      viewLayer = new ViewLayer({
        id: layerId,
        view: this,
        viewer: this.viewer,
      });
      this.layers[layerId] = viewLayer;
      this.viewer.events.onViewLayerCreated.dispatch(this, viewLayer);
    }
    const viewObject = new ViewObject(viewLayer, sceneObject);
    viewLayer._attachViewObject(viewObject);
    this._attachViewObject(viewObject);
    this.viewer.events.onViewObjectCreated.dispatch(this, viewObject);
    this.needsRender();
  }

  /**
   * @private
   */
  _attachViewObject(viewObject: ViewObject) {
    const objectId = viewObject.id;
    if (this.objects[objectId]) {
      return;
    }
    this.objects[objectId] = viewObject;
    this._numObjects++;
    this._objectIds = null; // Lazy regenerate
  }

  /**
   * @private
   */
  _detachSceneObject(sceneObject: SceneObject) {
    const viewObject = this.objects[sceneObject.id];
    if (viewObject) {
      const layerId = sceneObject.layerId || "default";
      this._deattachViewObject(viewObject);
      const viewLayer = this.layers[layerId];
      if (viewLayer) {
        viewLayer._deattachViewObject(viewObject);
        if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
          viewLayer.destroy();
        }
      }
      this.viewer.events.onViewObjectDestroyed.dispatch(this, viewObject);
      this.needsRender();
    }
  }

  /**
   * @private
   */
  _deattachViewObject(viewObject: ViewObject) {
    const objectId = viewObject.id;
    if (!this.objects[objectId]) {
      return;
    }
    delete this.objects[objectId];
    delete this.visibleObjects[objectId];
    delete this.xrayedObjects[objectId];
    delete this.highlightedObjects[objectId];
    delete this.selectedObjects[objectId];
    delete this.colorizedObjects[objectId];
    delete this.opacityObjects[objectId];
    this._numObjects--;
    this._objectIds = null; // Lazy regenerate
  }

  /**
   * Sets whether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.autoLayers] View already destroyed"
      });
      return;
    }
    if (this._autoLayers === autoLayers) {
      return;
    }
    this._autoLayers = autoLayers;
    if (autoLayers) {
      this._createViewObjectsForScene();
    }
  }

  private _createViewObjectsForScene() {
    const scene = this.viewer.scene;
    if (!scene) {
      return;
    }
    for (const sceneObjectId in scene.objects) {
      const sceneObject = scene.objects[sceneObjectId];
      this._attachSceneObject(sceneObject);
    }
  }

  /**
   * Gets whether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
   * as {@link ViewObject | ViewerObjects} are created.
   */
  get autoLayers(): boolean {
    return this._autoLayers;
  }

  /**
   * Sets which rendering mode this View is in.
   *
   * Default value is {@link constants!DetailedRender | DetailedRender}.
   *
   * Setting a View's rendering mode will activate whatever effects (eg. SAO, edges, canas scaling) are configured to
   * be active in that mode, while deactivating all other effects.
   */
  set renderMode(renderMode: number) {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.renderMode] View already destroyed"
      });
      return;
    }
    this._renderMode = renderMode;
    this.needsRender();
  }

  /**
   * Gets which rendering mode this View is in.
   *
   * Default value is {@link constants!DetailedRender | DetailedRender}.
   */
  get renderMode(): number {
    return this._renderMode;
  }

  /**
   * Gets the canvas clear color.
   *
   * Default value is ````[1, 1, 1]````.
   */
  get backgroundColor(): FloatArrayParam {
    return this._backgroundColor;
  }

  /**
   * Sets the canvas clear color.
   *
   * Default value is ````[1, 1, 1]````.
   */
  set backgroundColor(value: FloatArrayParam) {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.backgroundColor] View already destroyed"
      });
      return;
    }
    if (value) {
      if (value.length < 3) {
        this.viewer.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[View.backgroundColor] Expected FloatArrayParam with at least 3 elements"
        });
        return;
      }
      this._backgroundColor[0] = value[0];
      this._backgroundColor[1] = value[1];
      this._backgroundColor[2] = value[2];
    } else {
      this._backgroundColor[0] = 1.0;
      this._backgroundColor[1] = 1.0;
      this._backgroundColor[2] = 1.0;
    }
    this.needsRender();
  }

  /**
   * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link View.backgroundColor}
   * when {@link View.transparent} is ```true```.
   *
   * When {@link View.transparent} is ```true``` and this is ````true````, then the canvas clear color will
   * be taken from the ambient light color.
   *
   * When {@link View.transparent} is ```true``` and this is ````false````, then the canvas clear color will
   * be taken from {@link View.backgroundColor}.
   *
   * Default value is ````true````.
   */
  get backgroundColorFromAmbientLight(): boolean {
    return this._backgroundColorFromAmbientLight;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.backgroundColorFromAmbientLight] View already destroyed"
      });
      return;
    }
    this._backgroundColorFromAmbientLight =
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
    return this._numObjects;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this View.
   */
  get objectIds(): string[] {
    if (!this._objectIds) {
      this._objectIds = Object.keys(this.objects);
    }
    return this._objectIds;
  }

  /**
   * Gets the number of visible {@link ViewObject | ViewObjects} in this View.
   */
  get numVisibleObjects(): number {
    return this._numVisibleObjects;
  }

  /**
   * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this View.
   */
  get visibleObjectIds(): string[] {
    if (!this._visibleObjectIds) {
      this._visibleObjectIds = Object.keys(this.visibleObjects);
    }
    return this._visibleObjectIds;
  }

  /**
   * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this View.
   */
  get numXRayedObjects(): number {
    return this._numXRayedObjects;
  }

  /**
   * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this View.
   */
  get xrayedObjectIds(): string[] {
    if (!this._xrayedObjectIds) {
      this._xrayedObjectIds = Object.keys(this.xrayedObjects);
    }
    return this._xrayedObjectIds;
  }

  /**
   * Gets the number of highlighted {@link ViewObject | ViewObjects} in this View.
   */
  get numHighlightedObjects(): number {
    return this._numHighlightedObjects;
  }

  /**
   * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this View.
   */
  get highlightedObjectIds(): string[] {
    if (!this._highlightedObjectIds) {
      this._highlightedObjectIds = Object.keys(this.highlightedObjects);
    }
    return this._highlightedObjectIds;
  }

  /**
   * Gets the number of selected {@link ViewObject | ViewObjects} in this View.
   */
  get numSelectedObjects(): number {
    return this._numSelectedObjects;
  }

  /**
   * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this View.
   */
  get selectedObjectIds(): string[] {
    if (!this._selectedObjectIds) {
      this._selectedObjectIds = Object.keys(this.selectedObjects);
    }
    return this._selectedObjectIds;
  }

  /**
   * Gets the number of colorized {@link ViewObject | ViewObjects} in this View.
   */
  get numColorizedObjects(): number {
    return this._numColorizedObjects;
  }

  /**
   * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this View.
   */
  get colorizedObjectIds(): string[] {
    if (!this._colorizedObjectIds) {
      this._colorizedObjectIds = Object.keys(this.colorizedObjects);
    }
    return this._colorizedObjectIds;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this View that have updated opacities.
   */
  get opacityObjectIds(): string[] {
    if (!this._opacityObjectIds) {
      this._opacityObjectIds = Object.keys(this.opacityObjects);
    }
    return this._opacityObjectIds;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this View that have updated opacities.
   */
  get numOpacityObjects(): number {
    return this._numOpacityObjects;
  }

  /**
   * Called by ViewObject.visible setter.
   * @private
   */
  objectVisibilityUpdated(
      viewObject: ViewObject,
      visible: boolean,
      notify: boolean = true
  ) {
    if (visible) {
      this.visibleObjects[viewObject.id] = viewObject;
      this._numVisibleObjects++;
    } else {
      delete this.visibleObjects[viewObject.id];
      this._numVisibleObjects--;
    }
    this._visibleObjectIds = null; // Lazy regenerate
    if (notify) {
      this.viewer.events.onViewObjectVisibleChanged.dispatch(this, viewObject);
    }
    this.needsRender();
  }

  /**
   * Called by ViewObject.xrayed setter.
   * @private
   */
  objectXRayedUpdated(
      viewObject: ViewObject,
      xrayed: boolean,
      notify: boolean = true
  ) {
    if (xrayed) {
      this.xrayedObjects[viewObject.id] = viewObject;
      this._numXRayedObjects++;
    } else {
      delete this.xrayedObjects[viewObject.id];
      this._numXRayedObjects--;
    }
    this._xrayedObjectIds = null; // Lazy regenerate
    if (notify) {
      this.viewer.events.onViewObjectXRayedChanged.dispatch(this, viewObject);
    }
    this.needsRender();
  }

  /**
   * Called by ViewObject.highlighted setter.
   * @private
   */
  objectHighlightedUpdated(
      viewObject: ViewObject,
      highlighted: boolean,
      notify: boolean = true) {
    if (highlighted) {
      this.highlightedObjects[viewObject.id] = viewObject;
      this._numHighlightedObjects++;
    } else {
      delete this.highlightedObjects[viewObject.id];
      this._numHighlightedObjects--;
    }
    this._highlightedObjectIds = null; // Lazy regenerate
    if (notify) {
      this.viewer.events.onViewObjectHighlightedChanged.dispatch(this, viewObject);
    }
    this.needsRender();
  }

  /**
   * Called by ViewObject.selected setter.
   * @private
   */
  objectSelectedUpdated(
      viewObject: ViewObject,
      selected: boolean,
      notify: boolean = true) {
    if (selected) {
      this.selectedObjects[viewObject.id] = viewObject;
      this._numSelectedObjects++;
    } else {
      delete this.selectedObjects[viewObject.id];
      this._numSelectedObjects--;
    }
    this._selectedObjectIds = null; // Lazy regenerate
    if (notify) {
      this.viewer.events.onViewObjectSelectedChanged.dispatch(this, viewObject);
    }
    this.needsRender();
  }

  /**
   * Called by ViewObject.colorize setter.
   * @private
   */
  objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
    if (colorized) {
      this.colorizedObjects[viewObject.id] = viewObject;
      this._numColorizedObjects++;
    } else {
      delete this.colorizedObjects[viewObject.id];
      this._numColorizedObjects--;
    }
    this._colorizedObjectIds = null; // Lazy regenerate
    this.viewer.events.onViewObjectColorizeChanged.dispatch(this, viewObject);
    this.needsRender();
  }

  /**
   * Called by ViewObject.opacity setter.
   * @private
   */
  objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
    if (opacityUpdated) {
      this.opacityObjects[viewObject.id] = viewObject;
      this._numOpacityObjects++;
    } else {
      delete this.opacityObjects[viewObject.id];
      this._numOpacityObjects--;
    }
    this._opacityObjectIds = null; // Lazy regenerate
    this.viewer.events.onViewObjectOpacityChanged.dispatch(this, viewObject);
    this.needsRender();
  }

  /**
   * Called by ViewObject.pickable setter.
   * @param viewObject
   * @param pickable
   */
  objectPickableUpdated(viewObject: ViewObject, pickable: boolean) {
    this.viewer.events.onViewObjectPickableChanged.dispatch(this, viewObject);
    this.needsRender();
  }

  /**
   * Creates a {@link SectionPlane} in this View.
   *
   * The SectionPlane is then registered in {@link View.sectionPlanes}.
   *
   * If a SectionPlane with the given ID already exists, the method returns an error.
   *
   * # Usage
   *
   * ```typescript
   * const sectionPlaneResult = view.createSectionPlane({
   *   id: "mySectionPlane",
   *   pos: [0, 0, 0],
   *   dir: [1, 0, 0],
   * });
   *
   * if (!sectionPlaneResult.ok) {
   *   console.error(sectionPlaneResult.error);
   * } else {
   *   const sectionPlane = sectionPlaneResult.value;
   *   console.log("SectionPlane created:", sectionPlane.id);
   * }
   *```
   *
   * @param sectionPlaneParams - Configuration parameters for the new {@link SectionPlane}.
   * @returns A result containing the created {@link SectionPlane} on success,
   * or an error message on failure.
   */
  createSectionPlane(sectionPlaneParams: SectionPlaneParams): SDKResult<SectionPlane> {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.createSectionPlane] View already destroyed"
      });
      return;
    }
    sectionPlaneParams.id ||= createUUID();
    if (this.sectionPlanes[sectionPlaneParams.id]) {
      return this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[View.createSectionPlane] SectionPlane with ID "${sectionPlaneParams.id}" already exists.`
      });
    }
    const sectionPlane = new SectionPlane(this, sectionPlaneParams);
    this.sectionPlanesList.push(sectionPlane);
    this.sectionPlanes[sectionPlane.id] = sectionPlane;
    this._sectionPlanesHash = null;
    //    this.rebuild();
    this.viewer.events.onSectionPlaneCreated.dispatch(this, sectionPlane);
    return {
      ok: true,
      value: sectionPlane
    };
  }

  /**
   * Called by a {@link SectionPlane} when destroyed.
   * @private
   */
  _removeSectionPlane(sectionPlane: SectionPlane) {
    this._deregisterSectionPlane(sectionPlane);
    this.viewer.events.onSectionPlaneDestroyed.dispatch(this, sectionPlane);
  }

  /**
   * Destroys the {@link SectionPlane | SectionPlanes} in this View.
   */
  clearSectionPlanes(): void {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.clearSectionPlanes] View already destroyed"
      });
      return;
    }
    const objectIds = Object.keys(this.sectionPlanes);
    for (let i = 0, len = objectIds.length; i < len; i++) {
      this.sectionPlanes[objectIds[i]].destroy();
    }
    this.sectionPlanesList.length = 0;
    this._sectionPlanesHash = null;
  }

  /**
   * @private
   */
  getSectionPlanesHash() {
    if (this._sectionPlanesHash) {
      return this._sectionPlanesHash;
    }
    if (this.sectionPlanesList.length === 0) {
      return (this._sectionPlanesHash = ";");
    }
    const hashParts = [];
    for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
      hashParts.push("cp");
    }
    hashParts.push(";");
    this._sectionPlanesHash = hashParts.join("");
    return this._sectionPlanesHash;
  }

  /**
   * @private
   */
  registerLight(light: PointLight | DirLight | AmbientLight) {
    this.lightsList.push(light);
    this.lightSources[light.id] = light;
    this._lightsHash = null;
    //  this.rebuild();
  }

  /**
   * @private
   */
  deregisterLight(light: PointLight | DirLight | AmbientLight) {
    for (let i = 0, len = this.lightsList.length; i < len; i++) {
      if (this.lightsList[i].id === light.id) {
        this.lightsList.splice(i, 1);
        this._lightsHash = null;
        delete this.lightSources[light.id];
        //       this.rebuild();
        return;
      }
    }
  }

  /**
   * Destroys the {@link DirLight | DirLights}, {@link PointLight | PointLights} and {@link AmbientLight | AmbientLights} in this View.
   */
  clearLights(): void {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.clearLights] View already destroyed"
      });
      return;
    }
    const lightIds = Object.keys(this.lightSources);
    for (let i = 0, len = lightIds.length; i < len; i++) {
      this.lightSources[lightIds[i]].destroy();
    }
  }

  /**
   * @private
   */
  getLightsHash() {
    if (this._lightsHash) {
      return this._lightsHash;
    }
    if (this.lightsList.length === 0) {
      return (this._lightsHash = ";");
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
    this._lightsHash = hashParts.join("");
    return this._lightsHash;
  }

  /**
   * @private
   */
  needsRender() {
    if (this._needsRender) {
      return;
    }
    this._needsRender = true;
    this._fireViewUpdatedEventTask.schedule();
  }

  private readonly _ambientColorAndIntensity: FloatArrayParam = new Float32Array([0.5, 0.5, 0.5, 1]);

  /**
   * @private
   */
  getAmbientColorAndIntensity(): FloatArrayParam {
    return this._ambientColorAndIntensity;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsVisible] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.visible !== visible) {
        viewObject.visible = visible;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsCollidable] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.collidable !== collidable) {
        viewObject.collidable = collidable;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsCulled] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.culled !== culled) {
        viewObject.culled = culled;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsSelected] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.selected !== selected) {
        viewObject.selected = selected;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsHighlighted] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.highlighted !== highlighted) {
        viewObject.highlighted = highlighted;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsXRayed] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.xrayed !== xrayed) {
        viewObject.xrayed = xrayed;
        changed = true;
      }
    }

    return changed;
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
  setObjectsColorized(objectIds: string[], colorize: Vec3) {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsColorized] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      viewObject.colorize = colorize;
      changed = true;
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjecrsOpacity] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.opacity !== opacity) {
        viewObject.opacity = opacity;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsPickable] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.pickable !== pickable) {
        viewObject.pickable = pickable;
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.setObjectsClippable] View already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.clippable !== clippable) {
        viewObject.clippable = clippable;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this View.
   *
   * @param objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link ViewObject}.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  withObjects(objectIds: string[], callback: Function): boolean {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.withObjects] View already destroyed"
      });
      return;
    }
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
   * Fires {@link viewer!ViewerEvents.onViewLayerCreated | ViewerEvents.onViewLayerCreated} event.
   *
   * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link ViewLayer.destroy}
   * is called, or the {@link View} itself is destroyed. If a ViewLayer with the given ID already exists, the method
   * returns that existing ViewLayer. The method also ensures that the existing ViewLayer likewise persists.
   *
   * # Usage
   *
   * ```typescript
   * const layerResult = view.createLayer({
   *   id: "myLayer",
   *   autoDestroy: true,
   * });
   *
   * if (!layerResult.ok) {
   *   console.error(layerResult.error);
   * } else {
   *   const viewLayer = layerResult.value;
   *   console.log("ViewLayer created:", viewLayer.id);
   * }
   * ```
   * @param viewLayerParams - Configuration parameters for the new {@link ViewLayer}.
   * @returns A result containing the created {@link ViewLayer} on success, or an error message on failure.
   */
  createLayer(viewLayerParams: ViewLayerParams): SDKResult<ViewLayer> {
    if (!viewLayerParams.id) {
      return this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[View.createLayer] Missing layer ID."
      });
    }

    let viewLayer = this.layers[viewLayerParams.id];
    if (viewLayer) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[View.createLayer] ViewLayer with ID "${viewLayerParams.id}" already exists.`
      };
    }
    viewLayer = new ViewLayer({
      id: viewLayerParams.id,
      view: this,
      viewer: this.viewer,
      autoDestroy: viewLayerParams.autoDestroy || false
    });
    this.layers[viewLayerParams.id] = viewLayer;
    this.viewer.events.onViewLayerCreated.dispatch(this, viewLayer);
    return {
      ok: true,
      value: viewLayer
    };
  }

  /**
   * Creates a {@link ViewTransform} in this View.
   * @param viewTransformParams
   */
  createTransform(viewTransformParams: ViewTransformParams): SDKResult<ViewTransform> {
    if (!viewTransformParams.id) {
      return this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[View.createTransform] Missing transform ID."
      });
    }

    let viewTransform = this.transforms[viewTransformParams.id];
    if (viewTransform) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[View.createTransform] ViewTransform with ID "${viewTransformParams.id}" already exists.`
      };
    }
    viewTransform = new ViewTransform(this, viewTransformParams);
    this.transforms[viewTransformParams.id] = viewTransform;
    this.viewer.events.onViewTransformCreated.dispatch(this, viewTransform);
    return {
      ok: true,
      value: viewTransform
    };
  }

  _destroyTransform(viewTransform: ViewTransform) {
    delete this.transforms[viewTransform.id];
    this.viewer.events.onViewTransformDestroyed.dispatch(this, viewTransform);
  }

  /**
   * @private
   * @param viewLayer
   */
  _destroyLayer(viewLayer: ViewLayer) {
    delete this.layers[viewLayer.id];
    this.viewer.events.onViewLayerDestroyed.dispatch(this, viewLayer);
  }


  // #registerSectionPlane(sectionPlane: SectionPlane) {
  //   this.sectionPlanesList.push(sectionPlane);
  //   this.sectionPlanes[sectionPlane.id] = sectionPlane;
  //   this.#sectionPlanesHash = null;
  //   this.rebuild();
  //   this.viewer.events.onSectionPlaneCreated.dispatch(this, sectionPlane);
  // }

  /**
   * @private
   * @param sectionPlane
   */
  _deregisterSectionPlane(sectionPlane: SectionPlane) {
    for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
      if (this.sectionPlanesList[i].id === sectionPlane.id) {
        this.sectionPlanesList.splice(i, 1);
        this._sectionPlanesHash = null;
        delete this.sectionPlanes[sectionPlane.id];
        // this.rebuild();
        this.viewer.events.onSectionPlaneDestroyed.dispatch(this, sectionPlane);
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
  fromParams(viewParams: ViewParams): SDKResult<any> {
    if (this.destroyed) {
      return this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[View.fromParams] View "${this.id}" has been destroyed`
      });
    }
    if (viewParams.camera) {
      const result = this.camera.fromParams(viewParams.camera);
      if (result.ok === false) {
        return result;
      }
    }
    if (viewParams.renderMode !== undefined) {
      this.renderMode = viewParams.renderMode;
    }
    if (viewParams.backgroundColor !== undefined) {
      this.backgroundColor = viewParams.backgroundColor;
    }
    if (viewParams.backgroundColorFromAmbientLight !== undefined) {
      this.backgroundColorFromAmbientLight = viewParams.backgroundColorFromAmbientLight;
    }
    if (viewParams.autoLayers !== undefined) {
      this.autoLayers = viewParams.autoLayers;
    }
    if (viewParams.layers) {
      for (const viewLayerParams of viewParams.layers) {
        const existingViewLayer = this.layers[viewLayerParams.id];
        if (!existingViewLayer) {
          const result = this.createLayer(viewLayerParams);
          if (result.ok === false) {
            return result;
          }
        }
      }
    }
    // if (viewParams.sectionPlanes) {
    //     for (const sectionPlaneParams of viewParams.sectionPlanes) {
    //         const existingSectionPlane = this.sectionPlanes[sectionPlaneParams.id];
    //         if (existingSectionPlane) {
    //             const result = existingSectionPlane.fromParams(sectionPlaneParams);
    //             if (result.ok === false) {
    //                 return result;
    //             }
    //         } else {
    //             const result = this.createSectionPlane(sectionPlaneParams);
    //             if (result.ok === false) {
    //                 return result;
    //             }
    //         }
    //     }
    // }
    if (viewParams.effects) {
      const e = viewParams.effects;
      if (e.sao) {
        const result = this.effects.sao.fromParams(e.sao);
        if (result.ok === false) {
          return result;
        }
      }
      if (e.shadows) {
        const result = this.effects.shadows.fromParams(e.shadows);
        if (result.ok === false) {
          return result;
        }
      }
      if (e.tonemap) {
        const result = this.effects.tonemap.fromParams(e.tonemap);
        if (result.ok === false) {
          return result;
        }
      }
      if (e.antiAliasing) {
        const result = this.effects.antiAliasing.fromParams(e.antiAliasing);
        if (result.ok === false) {
          return result;
        }
      }
      if (e.bloom) {
        const result = this.effects.bloom.fromParams(e.bloom);
        if (result.ok === false) {
          return result;
        }
      }
      if (e.edges) {
        const result = this.effects.edges.fromParams(e.edges);
        if (result.ok === false) {
          return result;
        }
      }
    }
    if (viewParams.highlightMaterial) {
      const result = this.highlightMaterial.fromParams(viewParams.highlightMaterial);
      if (result.ok === false) {
        return result;
      }
    }
    if (viewParams.selectedMaterial) {
      const result = this.selectedMaterial.fromParams(viewParams.selectedMaterial);
      if (result.ok === false) {
        return result;
      }
    }
    if (viewParams.xrayMaterial) {
      const result = this.xrayMaterial.fromParams(viewParams.xrayMaterial);
      if (result.ok === false) {
        return result;
      }
    }
    if (viewParams.pointsMaterial) {
      const result = this.pointsMaterial.fromParams(viewParams.pointsMaterial);
      if (result.ok === false) {
        return result;
      }
    }
    // TODO: Update lights
    return {
      ok: true,
      value: null
    };
  }

  /**
   * Gets this View as JSON.
   */
  toParams(): SDKResult<ViewParams> {
    return {
      ok: true,
      value: {
        id: this.id,
        camera: (<{ value: CameraParams }>this.camera.toParams()).value,
        autoLayers: this.autoLayers,
        layers: Object.values(this.layers).map(viewLayer => (<{ value: ViewLayerParams }>viewLayer.toParams()).value),
        // sectionPlanes: Object.values(this.sectionPlanes).map(sectionPlane => (<{ value: SectionPlaneParams }>sectionPlane.toParams()).value),
        // lights: Object.values(this.lightSources).map(light => light.toParams()),
        effects: {
          sao:          (<{ value: SAOParams          }>this.effects.sao.toParams()).value,
          shadows:      (<{ value: ShadowsParams      }>this.effects.shadows.toParams()).value,
          tonemap:      (<{ value: TonemapParams      }>this.effects.tonemap.toParams()).value,
          antiAliasing: (<{ value: AntiAliasingParams }>this.effects.antiAliasing.toParams()).value,
          bloom:        (<{ value: BloomParams        }>this.effects.bloom.toParams()).value,
          edges:        (<{ value: EdgesParams        }>this.effects.edges.toParams()).value,
        },
        highlightMaterial: (<{ value: EffectParams }>this.highlightMaterial.toParams()).value,
        selectedMaterial: (<{ value: EffectParams }>this.selectedMaterial.toParams()).value,
        xrayMaterial: (<{ value: EffectParams }>this.xrayMaterial.toParams()).value,
        pointsMaterial: (<{ value: PointsMaterialParams }>this.pointsMaterial.toParams()).value,
        resolutionScale: (<{ value: ResolutionScaleParams }>this.resolutionScale.toParams()).value,
        renderMode: this.renderMode
      }
    };
  }

  /**
   * Destroys this View.
   *
   * Causes {@link Viewer | Viewer} to fire a "viewDestroyed" event.
   */
  destroy() {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[View.destroy] View already destroyed"
      });
      return;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._windowResizeListener) {
      window.removeEventListener('resize', this._windowResizeListener);
      this._windowResizeListener = null;
    }
    this._fireViewUpdatedEventTask.destroy();
    this._destroyViewLayers();
    this._destroyViewObjects();
    this.viewer._destroyView(this);
    this.destroyed = true;
  }

  _destroyViewLayers() {
    const layers = this.layers;
    for (const id in layers) {
      const viewLayer = layers[id];
      viewLayer.destroy();
    }
  }

  _destroyViewObjects() {
    const objects = this.objects;
    for (const id in objects) {
      const object = objects[id];
      const sceneObject = object.sceneObject;
      const layerId = sceneObject.layerId || "default";
      const viewLayer = this.layers[layerId];
      const viewObject = this.objects[object.id];
      this._deattachViewObject(viewObject);
      if (viewLayer) {
        viewLayer._deattachViewObject(viewObject);
        if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
          viewLayer.destroy();
        }
      }
      this.viewer.events.onViewObjectDestroyed.dispatch(this, viewObject);
    }
  }
}

export {View};
