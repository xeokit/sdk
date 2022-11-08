import * as utils from "../../utils/index";
import {View} from "../View";

const color = new Float32Array(3);

/**
 * Saves and restores a snapshot of the visual state of the {@link ViewObject}'s that represent objects within a {@link View}.
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
 * In the example below, we'll create a {@link Viewer} and use an {@link XKTLoaderPlugin} to load an ````.xkt```` model. When the model has loaded, we'll hide a couple of {@link ViewObject}s and save a snapshot of the visual states of all the ViewObjects in an ViewObjectsMemento. Then we'll show all the ViewObjects
 * again, and then we'll restore the visual states of all the ViewObjects again from the ViewObjectsMemento, which will hide those two ViewObjects again.
 *
 * ````javascript
 * import {Viewer, XKTLoaderPlugin, ViewObjectsMemento} from "xeokit-viewer.es.js";
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
 *      const viewObjectsMemento = new ViewObjectsMemento();
 *
 *      viewObjectsMemento.saveObjects(viewer.view);
 *
 *      // Show all objects
 *      viewer.view.set#viewObjectsVisible(viewer.view.objectIds, true);
 *
 *      // Restore the objects states again, which involves hiding those two objects again
 *      viewObjectsMemento.restoreViewObjects(viewer.view);
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
 * viewObjectsMemento.saveObjects(viewer.view, {
 *     visible: true,
 *     clippable: true
 * });
 *
 * //...
 *
 * // Restore the objects states again
 * viewObjectsMemento.restoreViewObjects(viewer.view);
 * ````
 */
class ViewObjectsMemento {

    #viewObjectsVisible: boolean[];
    #viewObjectsEdges: boolean[];
    #viewObjectsXrayed: boolean[];
    #viewObjectsHighlighted: boolean[];
    #viewObjectsSelected: boolean[];
    #viewObjectsClippable: boolean[];
    #viewObjectsPickable: boolean[];
    #viewObjectsColorize: number[];
    #viewObjectsHasColorize: boolean[];
    #viewObjectsOpacity: number[];
    numObjects: number;

    #mask?: {
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
     * Creates an ViewObjectsMemento.
     */
    constructor() {
        this.#viewObjectsVisible = [];
        this.#viewObjectsEdges = [];
        this.#viewObjectsXrayed = [];
        this.#viewObjectsHighlighted = [];
        this.#viewObjectsSelected = [];
        this.#viewObjectsClippable = [];
        this.#viewObjectsPickable = [];
        this.#viewObjectsColorize = [];
        this.#viewObjectsHasColorize = [];
        this.#viewObjectsOpacity = [];
        this.numObjects = 0;
    }

    /**
     * Saves a snapshot of the visual state of the {@link ViewObject}'s that represent objects within a {@link View}.
     *
     * @param view The view.
     * @param {Object} [mask] Masks what state gets saved. Saves all state when not supplied.
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

        this.#mask = mask ? utils.apply(mask, {}) : null;

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
                    this.#viewObjectsVisible[i] = object.visible;
                }
                if (edges) {
                    this.#viewObjectsEdges[i] = object.edges;
                }
                if (xrayed) {
                    this.#viewObjectsXrayed[i] = object.xrayed;
                }
                if (highlighted) {
                    this.#viewObjectsHighlighted[i] = object.highlighted;
                }
                if (selected) {
                    this.#viewObjectsSelected[i] = object.selected;
                }
                if (clippable) {
                    this.#viewObjectsClippable[i] = object.clippable;
                }
                if (pickable) {
                    this.#viewObjectsPickable[i] = object.pickable;
                }
                if (colorize) {
                    const objectColor = object.colorize;
                    if (objectColor) {
                        this.#viewObjectsColorize[i * 3 + 0] = objectColor[0];
                        this.#viewObjectsColorize[i * 3 + 1] = objectColor[1];
                        this.#viewObjectsColorize[i * 3 + 2] = objectColor[2];
                        this.#viewObjectsHasColorize[i] = true;
                    } else {
                        this.#viewObjectsHasColorize[i] = false;
                    }
                }
                if (opacity) {
                    this.#viewObjectsOpacity[i] = object.opacity;
                }
                this.numObjects++;
            }
        }
    }

    /**
     * Restores a {@link View}'s {@link ViewObject}'s to their state previously captured with {@link ViewObjectsMemento#saveObjects}.
     * @param view The view.
     */
    restoreViewObjects(view: View) {

        const mask = this.#mask;

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
                    object.visible = this.#viewObjectsVisible[i];
                }
                if (edges) {
                    object.edges = this.#viewObjectsEdges[i];
                }
                if (xrayed) {
                    object.xrayed = this.#viewObjectsXrayed[i];
                }
                if (highlighted) {
                    object.highlighted = this.#viewObjectsHighlighted[i];
                }
                if (selected) {
                    object.selected = this.#viewObjectsSelected[i];
                }
                if (clippable) {
                    object.clippable = this.#viewObjectsClippable[i];
                }
                if (pickable) {
                    object.pickable = this.#viewObjectsPickable[i];
                }
                if (colorize) {
                    if (this.#viewObjectsHasColorize[i]) {
                        color[0] = this.#viewObjectsColorize[i * 3 + 0];
                        color[1] = this.#viewObjectsColorize[i * 3 + 1];
                        color[2] = this.#viewObjectsColorize[i * 3 + 2];
                        object.colorize = color;
                    } else {
                        object.colorize = null;
                    }
                }
                if (opacity) {
                    object.opacity = this.#viewObjectsOpacity[i];
                }
                i++;
            }
        }
    }
}

export {ViewObjectsMemento};