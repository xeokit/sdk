import { Component, EventEmitter } from "@xeokit/core";
import type { FloatArrayParam, IntArrayParam } from "@xeokit/math";
import { ViewObject } from "./ViewObject";
import { SectionPlane } from "./SectionPlane";
import type { Viewer } from "./Viewer";
import { Metrics } from "./Metriqs";
import { SAO } from "./SAO";
import { LinesMaterial } from "./LinesMaterial";
import { ViewLayer } from "./ViewLayer";
import type { ViewLayerParams } from "./ViewLayerParams";
import type { SectionPlaneParams } from "./SectionPlaneParams";
import { EmphasisMaterial } from "./EmphasisMaterial";
import { EdgeMaterial } from "./EdgeMaterial";
import { PointsMaterial } from "./PointsMaterial";
import { Camera } from "./Camera";
import type { PointLight } from "./PointLight";
import { CameraFlightAnimation } from "./CameraFlightAnimation";
import type { AmbientLight } from "./AmbientLight";
import type { DirLight } from "./DirLight";
/**
 * An independently-configurable view of the models in a {@link @xeokit/viewer!Viewer}.
 *
 * See {@link @xeokit/viewer} for usage.
 *
 * ## Overview
 *
 * A View is an independently-configurable view of the {@link RendererViewObject | ViewerObjects} existing within a Viewer, with
 * its own HTML canvas. A View automatically contains a {@link ViewObject} for each existing ViewerObject. ViewObjects
 * function as a kind of proxy for the ViewerObjects, through which we control their appearance
 * (show/hide/highlight etc.) within that particular View's canvas.
 *
 * Using Views, we can essentially have multiple canvases viewing the same model, each canvas perhaps showing a different subset
 * of the objects, with different visual effects, camera position etc.
 *
 * ## Quickstart
 *
 * * Create a View with {@link Viewer.createView}
 * * Control the View's viewpoint and projection with {@link View.camera}
 * * Create light sources with {@link View.createLightSource}
 * * Create slicing planes with {@link View createSectionPlane}
 * * Each View automatically has a {@link ViewObject} for every {@link RendererViewObject}
 * * Uses {@link ViewLayer | ViewLayers} to organize ViewObjects into layers
 * * Optionally uses ViewLayers to mask which ViewObjects are automatically maintained
 * * Control the visibility of ViewObjects with {@link View.setObjectsVisible}
 * * Emphasise ViewObjects with {@link View.setObjectsHighlighted}, {@link View.setObjectsSelected}, {@link View.setObjectsXRayed} and {@link View.setObjectsColorized}
 *
 * ## Examples
 *
 * Create a view in a given canvas, with three objects visible and a couple of object X-rayed (rendered translucent):
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.setObjectsVisible(["myObject1", "myObject2", "myObject3", ...], true);
 * view1.setObjectsXRayed(["myObject1", "myObject", ...], true);
 * ````
 *
 * Create a second view, using a different canvas, that shows two objects visible, with one of them highlighted:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      canvasId: "myView2"
 * });
 *
 * view2.camera.eye = [-1.4, 1.5, 15.8];
 * view2.camera.look = [4.0, 3.7, 1.8];
 * view2.camera.up = [0.0, 0.9, 0.0];
 *
 * view2.setObjectsVisible(["myObject1", "myObject3", ...], true);
 * view2.setObjectsHighlighted(["myObject3", ...], true);
 * ````
 */
declare class View extends Component {
    #private;
    /**
       ID of this View, unique within the {@link @xeokit/viewer!Viewer}.
       */
    viewId: string;
    /**
     * The Viewer to which this View belongs.
     */
    readonly viewer: Viewer;
    /**
     * The index of this View in {@link Viewer.viewList}.
     * @private
     */
    viewIndex: number;
    /**
     * Manages the Camera for this View.
     */
    readonly camera: Camera;
    /**
     * The HTML canvas.
     */
    canvasElement: HTMLCanvasElement;
    /**
     * Indicates if this View is transparent.
     */
    readonly transparent: boolean;
    /**
     * Boundary of the canvas in absolute browser window coordinates.
     * Format is ````[xmin, ymin, xwidth, ywidth]````.
     */
    readonly boundary: number[];
    /**
     * Whether the logarithmic depth buffer is enabled for this View.
     */
    readonly logarithmicDepthBufferEnabled: boolean;
    /**
     * Configures Scalable Ambient Obscurance (SAO) for this View.
     */
    readonly sao: SAO;
    /**
     * Flies or jumps the View's {@link @xeokit/viewer!Camera}  to given positions.
     */
    readonly cameraFlight: CameraFlightAnimation;
    /**
     * Manages measurement units, origin and scale for this View.
     */
    readonly metrics: Metrics;
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
     * Configures the appearance of edges belonging to {@link ViewObject} in this View.
     */
    readonly edgeMaterial: EdgeMaterial;
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
     * each {@link RendererViewObject} in the {@link @xeokit/viewer!Viewer}
     */
    readonly objects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of the currently visible {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly visibleObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of currently x-rayed {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly xrayedObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of currently highlighted {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly highlightedObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of currently selected {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly selectedObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of currently colorized {@link ViewObject | ViewObjects} in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly colorizedObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of {@link ViewObject | ViewObjects} in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly opacityObjects: {
        [key: string]: ViewObject;
    };
    /**
     * Map of {@link SectionPlane}s in this View.
     *
     * Each {@link SectionPlane} is mapped here by {@link SectionPlane.id}.
     */
    readonly sectionPlanes: {
        [key: string]: SectionPlane;
    };
    /**
     * List of {@link SectionPlane}s in this View.
     */
    readonly sectionPlanesList: SectionPlane[];
    /**
     * Map of light sources in this View.
     */
    readonly lights: {
        [key: string]: AmbientLight | PointLight | DirLight;
    };
    /**
     * List of light sources in this View.
     */
    readonly lightsList: (AmbientLight | PointLight | DirLight)[];
    gammaOutput: boolean;
    /**
     * Map of the all {@link ViewLayer}s in this View.
     *
     * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
     */
    readonly layers: {
        [key: string]: ViewLayer;
    };
    /**
     * Whether the View will automatically create {@link ViewLayer | ViewLayers} on-demand
     * as {@link RendererViewObject | ViewerObjects} are created.
     *
     * When ````true```` (default), the View will automatically create {@link ViewLayer | ViewLayers} as needed for each new
     * {@link RendererViewObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
     * layerId. This default setting therefore ensures that a ViewObject is created in the View for every ViewerObject that is created.
     *
     * If you set this ````false````, however, then the View will only create {@link ViewObject | ViewObjects} for {@link RendererViewObject | ViewerObjects} that have
     * a {@link RendererViewObject.layerId} that matches the ID of a {@link ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * ViewerObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for ViewerObjects
     * that it never needs to show.
     */
    readonly autoLayers: boolean;
    /**
     * Emits an event each time the canvas boundary changes.
     *
     * @event
     */
    readonly onBoundary: EventEmitter<View, IntArrayParam>;
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
     * Layers are created explicitly with {@link View.createLayer}, or implicitly with {@link View.createModel} and {@link CreateModelParams.layerId}.
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
     * @private
     */
    constructor(options: {
        viewer: Viewer;
        origin?: number[];
        scale?: number;
        units?: number;
        canvasId?: string;
        canvasElement: HTMLCanvasElement;
        backgroundColor?: any[];
        backgroundColorFromAmbientLight?: boolean;
        premultipliedAlpha?: boolean;
        transparent?: boolean;
        qualityRender?: boolean;
        logarithmicDepthBufferEnabled?: boolean;
        autoLayers?: boolean;
    });
    /**
     *
     */
    get aabb(): FloatArrayParam;
    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    get backgroundColor(): FloatArrayParam;
    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    set backgroundColor(value: FloatArrayParam);
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
    get backgroundColorFromAmbientLight(): boolean;
    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     */
    set backgroundColorFromAmbientLight(backgroundColorFromAmbientLight: boolean);
    /**
     * Gets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @returns  The resolution scale.
     */
    get resolutionScale(): number;
    /**
     * Sets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @param resolutionScale The resolution scale.
     */
    set resolutionScale(resolutionScale: number);
    /**
     * Gets the gamma factor.
     */
    get gammaFactor(): number;
    /**
     * Gets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
    get qualityRender(): boolean;
    /**
     * Sets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
    set qualityRender(value: boolean);
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this View.
     */
    get numObjects(): number;
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this View.
     */
    get objectIds(): string[];
    /**
     * Gets the number of visible {@link ViewObject | ViewObjects} in this View.
     */
    get numVisibleObjects(): number;
    /**
     * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this View.
     */
    get visibleObjectIds(): string[];
    /**
     * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this View.
     */
    get numXRayedObjects(): number;
    /**
     * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this View.
     */
    get xrayedObjectIds(): string[];
    /**
     * Gets the number of highlighted {@link ViewObject | ViewObjects} in this View.
     */
    get numHighlightedObjects(): number;
    /**
     * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this View.
     */
    get highlightedObjectIds(): string[];
    /**
     * Gets the number of selected {@link ViewObject | ViewObjects} in this View.
     */
    get numSelectedObjects(): number;
    /**
     * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this View.
     */
    get selectedObjectIds(): string[];
    /**
     * Gets the number of colorized {@link ViewObject | ViewObjects} in this View.
     */
    get numColorizedObjects(): number;
    /**
     * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this View.
     */
    get colorizedObjectIds(): string[];
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this View that have updated opacities.
     */
    get opacityObjectIds(): string[];
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this View that have updated opacities.
     */
    get numOpacityObjects(): number;
    /**
     * @private
     */
    registerViewObject(viewObject: ViewObject): void;
    /**
     * @private
     */
    deregisterViewObject(viewObject: ViewObject): void;
    /**
     * @private
     */
    objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify?: boolean): void;
    /**
     * @private
     */
    objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean, notify?: boolean): void;
    /**
     * @private
     */
    objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean): void;
    /**
     * @private
     */
    objectSelectedUpdated(viewObject: ViewObject, selected: boolean): void;
    /**
     * @private
     */
    objectColorizeUpdated(viewObject: ViewObject, colorized: boolean): void;
    /**
     * @private
     */
    objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean): void;
    /**
     * Creates a {@link SectionPlane} in this View.
     *
     * @param sectionPlaneParams
     */
    createSectionPlane(sectionPlaneParams: SectionPlaneParams): SectionPlane;
    /**
     * Destroys the {@link SectionPlane}s in this View.
     */
    clearSectionPlanes(): void;
    /**
     * @private
     */
    getSectionPlanesHash(): string;
    /**
     * @private
     */
    registerLight(light: PointLight | DirLight | AmbientLight): void;
    /**
     * @private
     */
    deregisterLight(light: PointLight | DirLight | AmbientLight): void;
    /**
     * Destroys the light sources in this View.
     */
    clearLights(): void;
    /**
     * @private
     */
    getLightsHash(): string;
    /**
     * @private
     */
    rebuild(): void;
    /**
     * @private
     */
    redraw(): void;
    /**
     * Destroys this View.
     *
     * Causes {@link @xeokit/viewer!Viewer} to fire a "viewDestroyed" event.
     */
    destroy(): void;
    /**
     * @private
     */
    getAmbientColorAndIntensity(): FloatArrayParam;
    /**
     * Updates the visibility of the given {@link ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
     *
     * @param {String[]} objectIds Array of {@link ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(objectIds: string[], visible: boolean): boolean;
    /**
     * Updates the collidability of the given {@link ViewObject | ViewObjects} in this View.
     *
     * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(objectIds: string[], collidable: boolean): boolean;
    /**
     * Updates the culled status of the given {@link ViewObject | ViewObjects} in this View.
     *
     * Updates {@link ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(objectIds: string[], culled: boolean): boolean;
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
    setObjectsSelected(objectIds: string[], selected: boolean): boolean;
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
    setObjectsHighlighted(objectIds: string[], highlighted: boolean): boolean;
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
    setObjectsXRayed(objectIds: string[], xrayed: boolean): boolean;
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
    setObjectsColorized(objectIds: string[], colorize: number[]): boolean;
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
    setObjectsOpacity(objectIds: string[], opacity: number): boolean;
    /**
     * Sets the pickability of the given {@link ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
     *
     * @param {String[]} objectIds Array of {@link ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(objectIds: string[], pickable: boolean): boolean;
    /**
     * Sets the clippability of the given {@link ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to clip the given Objects with {@link SectionPlane}.
     *
     * @param {String[]} objectIds Array of {@link ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(objectIds: string[], clippable: boolean): boolean;
    /**
     * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this View.
     *
     * @param  objectIds One or more {@link ViewObject.id} values.
     * @param callback Callback to execute on each {@link ViewObject}.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    withObjects(objectIds: string[], callback: Function): boolean;
    /**
     * Creates a {@link ViewLayer} in this View.
     *
     * The ViewLayer is then registered in {@link View.layers}.
     *
     * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link ViewLayer.destroy}
     * is called, or the {@link @xeokit/viewer!View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
     * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
     *
     * @param viewLayerParams
     * @returns The new ViewLayer
     */
    createLayer(viewLayerParams: ViewLayerParams): ViewLayer;
}
export { View };
