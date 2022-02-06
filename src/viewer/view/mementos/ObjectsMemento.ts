
import * as utils from "../../utils";
import {View} from "../View";

const color = new Float32Array(3);

/**
 * @desc Saves and restores a snapshot of the visual state of the {@link ViewObject}'s that represent objects within a {@link View}.
 *
 * * An ViewObject represents an object when {@link ViewObject.isObject} is ````true````.
 * * Each object-ViewObject is registered by {@link ViewObject.id} in {@link View.objects}.
 *
 * ## See Also
 *
 * * {@link CameraMemento} - Saves and restores the state of a {@link View}'s {@link Camera}.
 * * {@link ModelMemento} - Saves and restores a snapshot of the visual state of the {@link ViewObject}'s of a model within a {@link View}.
 *
 * ## Usage
 *
 * In the example below, we'll create a {@link Viewer} and use an {@link XKTLoaderPlugin} to load an ````.xkt```` model. When the model has loaded, we'll hide a couple of {@link ViewObject}s and save a snapshot of the visual states of all the ViewObjects in an ObjectsMemento. Then we'll show all the ViewObjects
 * again, and then we'll restore the visual states of all the ViewObjects again from the ObjectsMemento, which will hide those two ViewObjects again.
 *
 * ````javascript
 * import {Viewer, XKTLoaderPlugin, ObjectsMemento} from "xeokit-webgpu-sdk.es.js";
 *
 * const viewer = new Viewer({
 *     canvasId: "myCanvas"
 * });
 *
 * // Load a model
 * const xktLoader = new XKTLoaderPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     id: "myModel",
 *     src: "./models/xkt/schependomlaan/schependomlaan.xkt"
 * });
 *
 * model.on("loaded", () => {
 *
 *      // Model has loaded
 *
 *      // Hide a couple of objects
 *      viewer.view.objects["0u4wgLe6n0ABVaiXyikbkA"].visible = false;
 *      viewer.view.objects["3u4wgLe3n0AXVaiXyikbYO"].visible = false;
 *
 *      // Save memento of all object states, which includes those two hidden objects
 *      const objectsMemento = new ObjectsMemento();
 *
 *      objectsMemento.saveObjects(viewer.view);
 *
 *      // Show all objects
 *      viewer.view.setObjectsVisible(viewer.view.objectIds, true);
 *
 *      // Restore the objects states again, which involves hiding those two objects again
 *      objectsMemento.restoreObjects(viewer.view);
 * });
 * `````
 *
 * ## Masking Saved State
 *
 * We can optionally supply a mask to focus what state we save and restore.
 *
 * For example, to save and restore only the {@link ViewObject#visible} and {@link ViewObject#clippable} states:
 *
 * ````javascript
 * objectsMemento.saveObjects(viewer.view, {
 *     visible: true,
 *     clippable: true
 * });
 *
 * //...
 *
 * // Restore the objects states again
 * objectsMemento.restoreObjects(viewer.view);
 * ````
 */
class ObjectsMemento {
    private readonly objectsVisible: boolean[];
    private readonly objectsEdges: boolean[];
    private readonly objectsXrayed: boolean[];
    private readonly objectsHighlighted: boolean[];
    private readonly objectsSelected: boolean[];
    private readonly objectsClippable: boolean[];
    private readonly objectsPickable: boolean[];
    private readonly objectsColorize: number[];
    private readonly objectsHasColorize: boolean[];
    private readonly objectsOpacity: number[];
    private numObjects: number;
    private _mask?: {
        opacity: boolean;
        colorize: boolean;
        pickable: boolean;
        clippable: boolean;
        selected: boolean;
        highlighted: boolean;
        xrayed: boolean;
        edges: boolean;
        visible: boolean;
    };

    /**
     * Creates an ObjectsMemento.
     */
    constructor() {
        this.objectsVisible = [];
        this.objectsEdges = [];
        this.objectsXrayed = [];
        this.objectsHighlighted = [];
        this.objectsSelected = [];
        this.objectsClippable = [];
        this.objectsPickable = [];
        this.objectsColorize = [];
        this.objectsHasColorize = [];
        this.objectsOpacity = [];
        this.numObjects = 0;
    }

    /**
     * Saves a snapshot of the visual state of the {@link ViewObject}'s that represent objects within a {@link View}.
     *
     * @param view The view.
     * @param {Object} [mask] Masks what state gets saved. Saves all state when not supplied.
     * @param {boolean} [mask.visible] Saves {@link ViewObject#visible} values when ````true````.
     * @param {boolean} [mask.visible] Saves {@link ViewObject#visible} values when ````true````.
     * @param {boolean} [mask.edges] Saves {@link ViewObject#edges} values when ````true````.
     * @param {boolean} [mask.xrayed] Saves {@link ViewObject#xrayed} values when ````true````.
     * @param {boolean} [mask.highlighted] Saves {@link ViewObject#highlighted} values when ````true````.
     * @param {boolean} [mask.selected] Saves {@link ViewObject#selected} values when ````true````.
     * @param {boolean} [mask.clippable] Saves {@link ViewObject#clippable} values when ````true````.
     * @param {boolean} [mask.pickable] Saves {@link ViewObject#pickable} values when ````true````.
     * @param {boolean} [mask.colorize] Saves {@link ViewObject#colorize} values when ````true````.
     * @param {boolean} [mask.opacity] Saves {@link ViewObject#opacity} values when ````true````.
     */
    saveObjects(view: View, mask?: {
        opacity: boolean;
        colorize: boolean;
        pickable: boolean;
        clippable: boolean;
        selected: boolean;
        highlighted: boolean;
        xrayed: boolean;
        edges: boolean;
        visible: boolean;
    }) {

        this.numObjects = 0;

        this._mask = mask ? utils.apply(mask, {}) : null;

        const objects = view.objects;
        const visible = (!mask || mask.visible);
        const edges = (!mask || mask.edges);
        const xrayed = (!mask || mask.xrayed);
        const highlighted = (!mask || mask.highlighted);
        const selected = (!mask || mask.selected);
        const clippable = (!mask || mask.clippable);
        const pickable = (!mask || mask.pickable);
        const colorize = (!mask || mask.colorize);
        const opacity = (!mask || mask.opacity);

        for (let objectId in objects) {
            if (objects.hasOwnProperty(objectId)) {
                const object = objects[objectId];
                const i = this.numObjects;
                if (visible) {
                    this.objectsVisible[i] = object.visible;
                }
                if (edges) {
                    this.objectsEdges[i] = object.edges;
                }
                if (xrayed) {
                    this.objectsXrayed[i] = object.xrayed;
                }
                if (highlighted) {
                    this.objectsHighlighted[i] = object.highlighted;
                }
                if (selected) {
                    this.objectsSelected[i] = object.selected;
                }
                if (clippable) {
                    this.objectsClippable[i] = object.clippable;
                }
                if (pickable) {
                    this.objectsPickable[i] = object.pickable;
                }
                if (colorize) {
                    const objectColor = object.colorize;
                    if (objectColor) {
                        this.objectsColorize[i * 3 + 0] = objectColor[0];
                        this.objectsColorize[i * 3 + 1] = objectColor[1];
                        this.objectsColorize[i * 3 + 2] = objectColor[2];
                        this.objectsHasColorize[i] = true;
                    } else {
                        this.objectsHasColorize[i] = false;
                    }
                }
                if (opacity) {
                    this.objectsOpacity[i] = object.opacity;
                }
                this.numObjects++;
            }
        }
    }

    /**
     * Restores a {@link View}'s {@link ViewObject}'s to their state previously captured with {@link ObjectsMemento#saveObjects}.
     * @param view The view.
     */
    restoreObjects(view: View) {

        const mask = this._mask;

        const visible = (!mask || mask.visible);
        const edges = (!mask || mask.edges);
        const xrayed = (!mask || mask.xrayed);
        const highlighted = (!mask || mask.highlighted);
        const selected = (!mask || mask.selected);
        const clippable = (!mask || mask.clippable);
        const pickable = (!mask || mask.pickable);
        const colorize = (!mask || mask.colorize);
        const opacity = (!mask || mask.opacity);

        let i = 0;

        const objects = view.objects;

        for (let objectId in objects) {
            if (objects.hasOwnProperty(objectId)) {
                const object = objects[objectId];
                if (visible) {
                    object.visible = this.objectsVisible[i];
                }
                if (edges) {
                    object.edges = this.objectsEdges[i];
                }
                if (xrayed) {
                    object.xrayed = this.objectsXrayed[i];
                }
                if (highlighted) {
                    object.highlighted = this.objectsHighlighted[i];
                }
                if (selected) {
                    object.selected = this.objectsSelected[i];
                }
                if (clippable) {
                    object.clippable = this.objectsClippable[i];
                }
                if (pickable) {
                    object.pickable = this.objectsPickable[i];
                }
                if (colorize) {
                    if (this.objectsHasColorize[i]) {
                        color[0] = this.objectsColorize[i * 3 + 0];
                        color[1] = this.objectsColorize[i * 3 + 1];
                        color[2] = this.objectsColorize[i * 3 + 2];
                        object.colorize = color;
                    } else {
                        object.colorize = null;
                    }
                }
                if (opacity) {
                    object.opacity = this.objectsOpacity[i];
                }
                i++;
            }
        }
    }
}

export {ObjectsMemento};