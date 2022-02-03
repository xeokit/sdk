import {Component} from '../Component';
import {Camera} from "./camera/";
import {Viewport} from "./Viewport.js";
import {Canvas} from "./Canvas";
import {CameraControl} from "./CameraControl";
import {Input} from "./Input.js";
import {CameraFlightAnimation} from "./camera";
import * as utils from "../utils/utils";
import {ViewObject} from "./ViewObject";
import {SectionPlane} from "./SectionPlane";
import {AmbientLight, DirLight, PointLight} from "./lights";
import {EdgeMaterial, EmphasisMaterial, PointsMaterial} from "./materials";
import {Viewer} from "../Viewer";
import {PickResult} from "./PickResult";
import {Metrics} from "./Metriqs";
import {Scene} from "../scene";
import {PickParams} from "./PickParams";

/**
 * An independent view of a {@link Viewer}'s {@link Scene}, with its own canvas, viewpoint, camera controls, light sources and visual object states.
 *
 * ## Overview
 *
 * - Belongs to a {@link Viewer}.
 * - Registered by {@link View.id} in {@link Viewer.views}.
 * - Multiple Views can be created of the same {@link Scene}.
 * - Has own {@link Canvas}, {@link Camera}, {@link CameraControl}, {@link SectionPlane}s and light sources.
 * - Has own {@link ViewObject}s which configure how the {@link SceneObject}s appear in the View.
 *
 * ## Remarks
 *
 * A View is an independently configurable view of its Viewer's Scene, with its own {@link Canvas},
 *  {@link Camera}, {@link SectionPlane}s, light sources, and object visual states.
 *
 * A View contains {@link ViewObject}s, each of which is a proxy for a {@link SceneObject} in the {@link Scene}. Through each ViewObject,
 * we can independently configure the way the SceneObject appears within the View, such as its visibility, transparency,
 * highlight and selection state, etc.
 *
 * This enables us to create multiple, independent views of our models. For example, we could have one View with a large
 * canvas that shows a 3D perspective View, accompanied by three more Views with smaller canvases, each showing
 * a 2D orthographic elevation along a separate axis.
 *
 * ## Usage
 *
 * In the example below we'll create a Viewer with two Views and a {@link WebIFCLoaderPlugin}.
 *
 * Each View gets its own HTML canvas. The first View shows a perspective 3D projection and allows us to orbit the model
 * with touch and mouse input. The second view shows an orthographic 2D plan view and only allows us to pan the model, not rotate.
 *
 * In the first View, we'll show only the IfcWalls. In the second View we'll X-ray everything and highlight the IfcDoors.
 *
 * ````javascript
 * import {Viewer, View, WebIFCLoaderPlugin} from
 * "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-webgpu-sdk/dist/xeokit-webgpu-sdk.es.min.js";
 *
 * const viewer = new Viewer();
 *
 * const view = new View(viewer, {
 *     canvasId: "myCanvas",
 *     transparent: true
 * });
 *
 * view.camera.eye = [-3.933, 2.855, 27.018];
 * view.camera.look = [4.400, 3.724, 8.899];
 * view.camera.up = [-0.018, 0.999, 0.039];
 * view.camera.projection = "perspective";
 * view.cameraControl.navMode = "orbit";
 *
 * const view2 = new View(viewer, {
 *     canvasId: "myCanvas2",
 *     transparent: true
 * });
 *
 * view2.camera.eye = [-3.933, 2.855, 27.018];
 * view2.camera.look = [4.400, 3.724, 8.899];
 * view2.camera.up = [-0.018, 0.999, 0.039];
 * view2.camera.projection = "ortho";
 * view2.cameraControl.navMode = "planView";
 *
 * const webIFCLoader = new WebIFCLoaderPlugin(viewer, {
 *   wasmPath: "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-webgpu-sdk/dist/"
 * });
 *
 * const model = webIFCLoader.load({
 *   id: "myModel",
 *   src: "Duplex.ifc",
 *   edges: true
 * });
 *
 * model.events.on("loaded", ()=> {
 *
 *      const metaModel = viewer.metaScene.metaModels["myModel"];
 *
 *      // View #1: show only IfcWalls
 *
 *      const ifcWallIds = Object.keys(metaModel.metaObjectsByType["IfcWall"]);
 *
 *      view1.setObjectsVisible(view1.objectIds, false);
 *      view1.setObjectsVisible(ifcWallIds, true);
 *
 *      // View 2: X-ray everything except for IfcDoors
 *
 *      const ifcDoorIds = Object.keys(metaModel.metaObjectsByType["IfcDoor"]);
 *
 *      view2.setObjectsXRayed(view2.objectIds, true);
 *      view2.setObjectsHighlighted(ifcDoorIds, true);
 * });
 ````
 */
class View extends Component {

    /**
     * The Viewer to which this View belongs.
     */
    public readonly viewer: Viewer;

    /**
     * The Scene that this View visualizes.
     */
    public readonly scene: Scene;

    /**
     * The index of this View in {@link Viewer.viewList}.
     */
    public viewIndex: number;

    /**
     * Manages the Camera for this View.
     */
    public readonly camera: Camera;

    /**
     * Manages the HTML canvas for this View.
     */
    public readonly canvas: Canvas;

    /**
     * Publishes input events that occur on this View's canvas.
     */
    public readonly input: Input;

    /**
     * Controls the View's {@link Camera} from user input.
     */
    public readonly cameraControl: CameraControl;

    /**
     * Flies or jumps the View's {@link Camera} to given positions.
     */
    public readonly cameraFlight: CameraFlightAnimation;

    /**
     * Manages the 2D viewpoint for this View.
     */
    public readonly viewport: Viewport;

    /**
     * Manages measurement units, origin and scale for this View.
     */
    public readonly metrics: Metrics;

    /**
     * Configures the X-rayed appearance of {@link ViewObject}s in this View.
     */
    public readonly xrayMaterial: EmphasisMaterial;

    /**
     * Configures the highlighted appearance of {@link ViewObject}s in this View.
     */
    public readonly highlightMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of {@link ViewObject}s in this View.
     */
    public readonly selectedMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of edges belonging to {@link ViewObject} in this View.
     */
    public readonly edgeMaterial: EdgeMaterial;

    /**
     * Configures the appearance of point primitives belonging to {@link ViewObject}s in this View .
     */
    public readonly pointsMaterial: PointsMaterial;

    /**
     * Map of all {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The View automatically ensures that there is a {@link ViewObject} here for
     * each {@link SceneObject} in the {@link Viewer}'s {@link Scene}.
     */
    public readonly objects: { [key: string]: ViewObject };

    /**
     * Map of currently visible {@link ViewObject}s in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link ViewObject}s in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link ViewObject}s in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link ViewObject}s in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link ViewObject}s in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly opacityObjects: { [key: string]: ViewObject };

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

    #lights: { [key: string]: (AmbientLight | PointLight | DirLight) };
    #sectionPlanes: { [key: string]: SectionPlane };

    /**
     * Creates a new View within a Viewer.
     *
     * The View will then be registered by {@link View.id} in {@link Viewer.views}.
     *
     * @param viewer The Viewer that owns this View.
     * @param options View configuration.
     * @param options.id Optional ID for this View.
     * @param options.canvasId -  ID of an existing HTML canvas for the View - either this or canvasElement is mandatory. When both values are given, the element reference is always preferred to the ID.
     * @param options.canvasElement - Reference of an existing HTML canvas. Either this or canvasId is mandatory. When both values are given, the element reference is always preferred to the ID.
     * @param options.transparent -  Whether or not the canvas is transparent.
     * @param options.premultipliedAlpha -  Whether or not you want alpha composition with premultiplied alpha. Highlighting and selection works best when this is ````false````.
     * @param options.backgroundColor=[1,1,1] - Sets the canvas background color to use when ````transparent```` is false.
     * @param options.backgroundColorFromAmbientLight - When ````transparent```` is false, set this ````true````
     * to derive the canvas background color from {@link AmbientLight.color}, or ````false```` to set the canvas background to ````backgroundColor````.
     */
    constructor(viewer: Viewer, options: {
        origin?: number[];
        scale?: number;
        units?: string;
        canvasId?: string;
        canvasElement?: HTMLCanvasElement;
        backgroundColor?: any[];
        backgroundColorFromAmbientLight?: boolean;
        premultipliedAlpha?: boolean;
        transparent?: boolean;
    } = {}) {

        super(viewer, options);

        this.viewer = viewer;

        this.scene = viewer.scene;

        const canvas = options.canvasElement || document.getElementById(options.canvasId);

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }

        this.viewIndex = 0;

        this.camera = new Camera(this);

        this.canvas = new Canvas(this, {
            canvas: canvas,
            transparent: options.transparent,
            backgroundColor: options.backgroundColor,
            backgroundColorFromAmbientLight: options.backgroundColorFromAmbientLight,
            premultipliedAlpha: options.premultipliedAlpha
        });

        this.canvas.events.on("boundary", () => {
            this.redraw();
        });

        this.cameraControl = new CameraControl(this, this.canvas, this.camera, {
            doublePickFlyTo: true
        });

        this.input = new Input(this, {
            element: this.canvas.canvas
        });

        this.cameraFlight = new CameraFlightAnimation(this, {
            duration: 0.5
        });

        this.viewport = new Viewport(this, {});

        this.metrics = new Metrics(this, {
            units: options.units,
            scale: options.scale,
            origin: options.origin
        });

        this.xrayMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.9, 0.7, 0.6],
            fillAlpha: 0.4,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.highlightMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [1.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.selectedMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.4, 0.5, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.edgeMaterial = new EdgeMaterial(this, {
            edgeColor: [0.0, 0.0, 0.0],
            edgeAlpha: 1.0,
            edgeWidth: 1,
            edges: true
        });

        this.pointsMaterial = new PointsMaterial(this, {
            pointSize: 1,
            roundPoints: true,
            perspectivePoints: true,
            minPerspectivePointSize: 1,
            maxPerspectivePointSize: 6,
            filterIntensity: false,
            minIntensity: 0,
            maxIntensity: 1
        });

        this.#lights = {};
        this.#sectionPlanes = {};

        this.objects = {};
        this.visibleObjects = {};
        this.xrayedObjects = {};
        this.highlightedObjects = {};
        this.selectedObjects = {};
        this.colorizedObjects = {};
        this.opacityObjects = {};

        this.#numObjects = 0;
        this.#numVisibleObjects = 0;
        this.#numXRayedObjects = 0
        this.#numHighlightedObjects = 0;
        this.#numSelectedObjects = 0;
        this.#numColorizedObjects = 0;
        this.#numOpacityObjects = 0;

        this.#initWebGPU();

        this.#initViewObjects();

        this.viewer.registerView(this);
    }

    /**
     * Gets the number of {@link ViewObject}s in this View.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }

    /**
     * Gets the number of visible {@link ViewObject}s in this View.
     */
    get numVisibleObjects(): number {
        return this.#numVisibleObjects;
    }

    /**
     * Gets the IDs of the visible {@link ViewObject}s in this View.
     */
    get visibleObjectIds(): string[] {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link ViewObject}s in this View.
     */
    get numXRayedObjects(): number {
        return this.#numXRayedObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link ViewObject}s in this View.
     */
    get xrayedObjectIds(): string[] {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }

    /**
     * Gets the number of highlighted {@link ViewObject}s in this View.
     */
    get numHighlightedObjects(): number {
        return this.#numHighlightedObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link ViewObject}s in this View.
     */
    get highlightedObjectIds(): string[] {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }

    /**
     * Gets the number of selected {@link ViewObject}s in this View.
     */
    get numSelectedObjects(): number {
        return this.#numSelectedObjects;
    }

    /**
     * Gets the IDs of the selected {@link ViewObject}s in this View.
     */
    get selectedObjectIds(): string[] {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }

    /**
     * Gets the number of colorized {@link ViewObject}s in this View.
     */
    get numColorizedObjects(): number {
        return this.#numColorizedObjects;
    }

    /**
     * Gets the IDs of the colorized {@link ViewObject}s in this View.
     */
    get colorizedObjectIds(): string[] {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View that have updated opacities.
     */
    get opacityObjectIds(): string[] {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }

    /**
     * Gets the number of {@link ViewObject}s in this View that have updated opacities.
     */
    get numOpacityObjects(): number {
        return this.#numOpacityObjects;
    }

    /**
     * @private
     * @private
     */
    registerViewObject(viewObject: ViewObject) {
        this.objects[viewObject.id] = viewObject;
        this.#numObjects++;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * @private
     * @private
     */
    deregisterViewObject(viewObject: ViewObject) {
        delete this.objects[viewObject.id];
        this.#numObjects--;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * Gets the {@link SectionPlane}s in this View.
     */
    public get sectionPlanes(): { [key: string]: SectionPlane } {
        return this.#sectionPlanes;
    }

    /**
     * @private
     */
    registerSectionPlane(sectionPlane: SectionPlane) {
        this.#sectionPlanes[sectionPlane.id] = sectionPlane;
    }

    /**
     * @private
     */
    deregisterSectionPlane(sectionPlane: SectionPlane) {
        delete this.#sectionPlanes[sectionPlane.id];
    }

    /**
     * @private
     */
    registerLight(light: PointLight | DirLight | AmbientLight) {
        this.#lights[light.id] = light;
    }

    /**
     * @private
     */
    deregisterLight(light: PointLight | DirLight | AmbientLight) {
        delete this.#lights[light.id];
    }

    /**
     * Gets the light sources in this View.
     */
    public get lights(): { [key: string]: (AmbientLight | PointLight | DirLight) } {
        return this.#lights;
    }

    /**
     * @private
     */
    redraw() {

    }

    /**
     * @private
     */
    recompile() {

    }

    /**
     * @private
     */
    objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify: boolean = true) {
        if (visible) {
            this.visibleObjects[viewObject.id] = viewObject;
            this.#numVisibleObjects++;
        } else {
            delete this.visibleObjects[viewObject.id];
            this.#numVisibleObjects--;
        }
        this.#visibleObjectIds = null; // Lazy regenerate
        if (notify) {
            this.events.fire("objectVisibility", viewObject, true);
        }
    }

    /**
     * @private
     */
    objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean) {
        if (xrayed) {
            this.xrayedObjects[viewObject.id] = viewObject;
            this.#numXRayedObjects++;
        } else {
            delete this.xrayedObjects[viewObject.id];
            this.#numXRayedObjects--;
        }
        this.#xrayedObjectIds = null; // Lazy regenerate
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
     * Updates the visibility of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.visible} on the ViewObjects with the given IDs.
     * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(ids: string[] | string, visible: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.collidable} on the ViewObjects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(ids: string[] | string, collidable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.culled} on the ViewObjects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(ids: string[] | string, culled: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.selected} on the ViewObjects with the given IDs.
     * - Updates {@link View.selectedObjects} and {@link View.numSelectedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(ids: string[] | string, selected: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.highlighted} on the ViewObjects with the given IDs.
     * - Updates {@link View.highlightedObjects} and {@link View.numHighlightedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(ids: string[] | string, highlighted: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.xrayed} on the ViewObjects with the given IDs.
     * - Updates {@link View.xrayedObjects} and {@link View.numXRayedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(ids: string[] | string, xrayed: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.xrayed !== xrayed);
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }

    /**
     * Colorizes the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.colorize} on the ViewObjects with the given IDs.
     * - Updates {@link View.colorizedObjects} and {@link View.numColorizedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(ids: string[] | string, colorize: number[]) {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.opacity} on the ViewObjects with the given IDs.
     * - Updates {@link View.opacityObjects} and {@link View.numOpacityObjects}.
     *
     * @param  ids - One or more {@link ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(ids: string[] | string, opacity: number): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.opacity !== opacity);
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }

    /**
     * Sets the pickability of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.pickable} on the ViewObjects with the given IDs.
     * - Enables or disables the ability to pick the given ViewObjects with {@link View.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(ids: string[] | string, pickable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.pickable !== pickable);
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }

    /**
     * Iterates with a callback over the given {@link ViewObject}s in this View.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param callback Callback to execute on each {@link ViewObject}.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    withObjects(ids: string[] | string, callback: Function): boolean {
        if (utils.isString(ids)) {
            // @ts-ignore
            ids = [ids];
        }
        let changed = false;
        for (let i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            let viewObject = this.objects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    /**
     * Attempts to pick a {@link ViewObject} in this View.
     *
     * - Ignores {@link ViewObject}s that have {@link ViewObject.pickable} set ````false````.
     * - When a {@link ViewObject} is picked, fires a "pick" event on the {@link ViewObject}, with the pick result as parameters.
     *
     * ### Usage
     *
     * Attempting to pick a {@link ViewObject} at the given canvas coordinates:

     * ````javascript
     * const pickResult = myView.pick({
     *     canvasPos: [23, 131]
     * });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     // Get geometry of the picked ViewObject
     *
     *     const sceneObject = myView.viewer.scene.sceneObjects[viewObject.id];
     *     const aabb = sceneObject.aabb; // 3D axis-aligned boundary
     *     const center = sceneObject.center; // 3D center
     *
     *     // Get metadata for the picked ViewObject
     *
     *     const metaObject = myView.viewer.metaScene.metaObjects[viewObject.id];
     *
     *     if (metaObject) {
     *
     *          const name = metaObject.name;
     *          const type = metaObject.type; // Eg. "IfcWall", "IfcBuildingStorey"
     *
     *          for (let propertySet of metaObject.propertySets) {
     *
     *              const propertySetId = propertySet.id;
     *              const propertySetName = propertySet.name;
     *              const propertySetType = propertySet.type;
     *
     *              for (let property of propertySet) {
     *
     *                  const propertyId = property.id;
     *                  const propertyName = property.name;
     *                  const propertyType = property.type;
     *
     *                  //...
     *              }
     *          }
     *
     *          const metaModel = metaObject.metaModel;
     *
     *          const projectId = metaModel.projectId;
     *          const revisionId = metaModel.revisionId;
     *          const author = metaModel.author;
     *          const createdAt = metaModel.createdAt;
     *          const creatingApplication = metaModel.creatingApplication;
     *          const schema = metaModel.schema;
     *
     *          //...
     *     }
     * }
     * ````
     *
     * Attempting to pick a 3D position on the surface of a {@link ViewObject}, at the given canvas coordinates:
     *
     * ````javascript
     * const pickResult = myView.pick({
     *     pickSurface: true,
     *     canvasPos: [23, 131]
     *  });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     if (pickResult.worldPos && pickResult.worldNormal) {
     *
     *         // Picked a point and normal on the ViewObject's surface
     *
     *         const worldPos = pickResult.worldPos;
     *         const worldNormal = pickResult.worldNormal;
     *     }
     * }
     * ````
     *
     * Picking the {@link ViewObject} that intersects an arbitrarily-aligned World-space ray:
     *
     * ````javascript
     * const pickResult = myView.pick({
     *     pickSurface: true,   // Picking with arbitrarily-positioned ray
     *     origin: [0,0,-5],    // Ray origin
     *     direction: [0,0,1]   // Ray direction
     * });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     if (pickResult.worldPos && pickResult.worldNormal) {
     *
     *         // Picked a point and normal on the ViewObject's surface
     *
     *         const worldPos = pickResult.worldPos;
     *         const worldNormal = pickResult.worldNormal;
     *     }
     * }
     *  ````
     *
     * @param params Picking parameters.
     * @param pickResult Holds the results of the pick attempt.
     * @returns Results when a {@link ViewObject} is successfully picked, else null.
     */
    pick(params: PickParams, pickResult?: PickResult): PickResult {

        if (this.canvas.boundary[2] === 0 || this.canvas.boundary[3] === 0) {
            this.error("Picking not allowed while canvas has zero width or height");
            return null;
        }

        params.pickSurface = params.pickSurface || params.rayPick; // Backwards compatibility

        if (!params.canvasPos && !params.matrix && (!params.origin || !params.direction)) {
            this.warn("picking without canvasPos, matrix, or ray origin and direction");
        }

        const includeEntities = params.includeEntities; // Backwards compat
        if (includeEntities) {
            //   params.includeViewObjectIds = getViewObjectIDMap(this.viewer.scene, includeEntities);
        }

        const excludeEntities = params.excludeEntities; // Backwards compat
        if (excludeEntities) {
            //  params.excludeViewObjectIds = getViewObjectIDMap(this.viewer.scene, excludeEntities);
        }

        // if (this._needRecompile) {
        //     this._recompile();
        //     this._renderer.imageDirty();
        //     this._needRecompile = false;
        // }
        //
        // pickResult = this._renderer.pick(params, pickResult);
        //
        // if (pickResult) {
        //     if (pickResult.viewObject && pickResult.viewObject.fire) {
        //         pickResult.viewObject.fire("picked", pickResult); // TODO: PerformanceModelNode doesn't fire events
        //     }
        //     return pickResult;
        // }
    }

    /**
     * @private
     */
    destroy() {
        this.viewer.deregisterView(this);
        super.destroy();
    }

    #initWebGPU() {

        // const device = this.viewer.#renderer.device;
        // const adapter = this.viewer._renderer.adapter;
        // const devicePixelRatio = window.devicePixelRatio || 1;
        // const presentationSize = [this.canvas.canvas.clientWidth * devicePixelRatio, this.canvas.canvas.clientHeight * devicePixelRatio];
        // const presentationFormat = this._context.getPreferredFormat(adapter);
        //
        // this._context = this._canvas.getContext('webgpu');
        // this._context.configure({device, format: presentationFormat, size: presentationSize});
        // this._swapChainFormat = 'bgra8unorm';
        // this._swapChain = this._context.configureSwapChain({device, format: this._swapChainFormat});
    }

    #initViewObjects() {
        const scene = this.viewer.scene;
        const sceneObjects = scene.sceneObjects;
        for (const id in sceneObjects) {
            this.#createViewObject(id);
        }
        scene.events.on("objectCreated", (sceneObject) => {
            this.#createViewObject(sceneObject.id);
        })
    }

    #createViewObject(id: string) {
        const sceneObject = this.viewer.scene.sceneObjects[id];
        if (!sceneObject) {
            this.error(`Can't create ViewObject: SceneObject not found: ${id}`);
            return;
        }
        const metaObject = this.viewer.metaScene.metaObjects[id];
        if (!metaObject) {
            this.error(`Can't create ViewObject: MetaObject not found: ${id}`);
            return;
        }
        const viewObject = new ViewObject(this, metaObject, sceneObject, {});
        this.registerViewObject(viewObject);
        sceneObject.events.on("destroy", () => {
            viewObject._destroy();
            this.deregisterViewObject(viewObject);
        });
        this.redraw();
    }
}

//
// function getViewObjectIDMap(scene:Scene, viewObjectIds:string[]) {
//     const map = {};
//     for (let i = 0, len = viewObjectIds.length; i < len; i++) {
//         const viewObjectId = viewObjectIds[i];
//         const viewObject = scene.component[viewObjectId];
//         if (!viewObject) {
//             scene.warn("pick(): Component not found: " + viewObjectId);
//             continue;
//         }
//         if (!viewObject.isViewObject) {
//             scene.warn("pick(): Component is not a ViewObject: " + viewObjectId);
//             continue;
//         }
//         map[viewObjectId] = true;
//     }
//     return map;
// }

export {View};
