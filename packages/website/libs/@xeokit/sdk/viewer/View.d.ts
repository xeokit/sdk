import { Component, EventEmitter, SDKError } from "../core";
import type { FloatArrayParam, IntArrayParam } from "../math";
import { ViewObject } from "./ViewObject";
import { SectionPlane } from "./SectionPlane";
import type { Viewer } from "./Viewer";
import { Metrics } from "./Metriqs";
import { SAO } from "./SAO";
import { Texturing } from "./Texturing";
import { LinesMaterial } from "./LinesMaterial";
import { ViewLayer } from "./ViewLayer";
import type { ViewLayerParams } from "./ViewLayerParams";
import type { SectionPlaneParams } from "./SectionPlaneParams";
import { EmphasisMaterial } from "./EmphasisMaterial";
import { Edges } from "./Edges";
import { PointsMaterial } from "./PointsMaterial";
import { Camera } from "./Camera";
import type { PointLight } from "./PointLight";
import { AmbientLight } from "./AmbientLight";
import { DirLight } from "./DirLight";
import type { PickParams } from "./PickParams";
import type { PickResult } from "./PickResult";
import { SnapshotResult } from "./SnapshotResult";
import type { SnapshotParams } from "./SnapshotParams";
import { ResolutionScale } from "./ResolutionScale";
import { ViewParams } from "./ViewParams";
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
 * An independent view within a {@link Viewer | Viewer}, with its own Canvas, Camera and object visual states.
 *
 * See {@link viewer | @xeokit/sdk/viewer } for usage.
 */
declare class View extends Component {
    #private;
    /**
     ID of this View, unique within the {@link Viewer | Viewer}.
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
    htmlElement: HTMLElement;
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
     * each {@link RendererObject} in the {@link Viewer | Viewer}
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
    /**
     * @private
     */
    constructor(viewer: Viewer, viewParams: ViewParams);
    /**
     * @private
     */
    initViewObjects(): void;
    /**
     * Sets wether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
     * as {@link RendererObject | ViewerObjects} are created.
     *
     * When ````true```` (default), the View will automatically create {@link ViewLayer | ViewLayers} as needed for each new
     * {@link RendererObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
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
    set autoLayers(autoLayers: boolean);
    /**
     * Gets wether this View will automatically create {@link ViewLayer | ViewLayers} on-demand
     * as {@link RendererObject | ViewerObjects} are created.
     */
    get autoLayers(): boolean;
    /**
     * Sets which rendering mode this View is in.
     *
     * Default value is {@link constants!QualityRender | QualityRender}.
     *
     * Setting a View's rendering mode will activate whatever effects (eg. SAO, edges, canas scaling) are configured to
     * be active in that mode, while deactivating all other effects.
     */
    set renderMode(renderMode: number);
    /**
     * Gets which rendering mode this View is in.
     *
     * Default value is {@link constants!QualityRender | QualityRender}.
     */
    get renderMode(): number;
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
     * Gets the gamma factor.
     */
    get gammaFactor(): number;
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
     * Destroys the {@link SectionPlane | SectionPlanes} in this View.
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
     * Destroys the {@link DirLight | DirLights}, {@link PointLight | PointLights} and {@link AmbientLight | AmbientLights} in this View.
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
     * @private
     */
    getAmbientColorAndIntensity(): FloatArrayParam;
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
    setObjectsVisible(objectIds: string[], visible: boolean): boolean;
    /**
     * Updates the collidability of the given {@link ViewObject | ViewObjects} in this View.
     *
     * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {string[]} objectIds Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(objectIds: string[], collidable: boolean): boolean;
    /**
     * Updates the culled status of the given {@link ViewObject | ViewObjects} in this View.
     *
     * Updates {@link ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {string[]} objectIds Array of {@link ViewObject.id} values.
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
     * @param {string[]} objectIds Array of {@link ViewObject.id} values.
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
     * @param objectIds Array of {@link ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(objectIds: string[], clippable: boolean): boolean;
    /**
     * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this View.
     *
     * @param objectIds One or more {@link ViewObject.id} values.
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
     * is called, or the {@link View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
     * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
     *
     * @param viewLayerParams
     * @returns The new ViewLayer
     */
    createLayer(viewLayerParams: ViewLayerParams): ViewLayer;
    /**
     * Attempts to pick a ViewObject in this View.
     *
     * @param pickParams Picking parameters.
     * @param pickResult Picking results, when caller wants to manage them externally.
     * @throws {@link core!SDKError | SDKError}
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     * * Illegal picking parameters given.
     * @returns {@link PickResult}
     * * Picking attempt completed.
     */
    pick(pickParams: PickParams, pickResult?: PickResult): PickResult | null | SDKError;
    /**
     * Enter snapshot mode.
     *
     * Switches rendering to a hidden snapshot canvas.
     *
     * Exit snapshot mode using {@link Viewer#endSnapshot}.
     */
    beginSnapshot(): void;
    /**
     * Captures a snapshot image of this View.
     *
     * @param snapshotParams
     * @param snapshotResult
     */
    getSnapshot(snapshotParams: SnapshotParams, snapshotResult?: SnapshotResult): SnapshotResult;
    getNumAllocatedSectionPlanes(): number;
    /**
     * Sets the state of this View.
     * @param viewParams
     */
    fromParams(viewParams: ViewParams): void;
    /**
     * Gets this View as JSON.
     */
    toParams(): ViewParams;
    /**
     * Destroys this View.
     *
     * Causes {@link Viewer | Viewer} to fire a "viewDestroyed" event.
     */
    destroy(): void;
}
export { View };
//# sourceMappingURL=View.d.ts.map