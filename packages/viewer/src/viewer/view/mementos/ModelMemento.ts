import {apply} from "../../utils/index";
import type {DataModel} from "../../data/DataModel";
import type {View} from "../View";

const color = new Float32Array(3);

/**
 * Saves and restores a snapshot of the visual state of the {@link ViewObject}'s of a model within a {@link Scene}.
 *
 * ## Usage
 *
 * In the example below, we'll create a {@link Viewer} and use an {@link TreeViewPlugin} to load an ````.xkt```` model. When the model has loaded, we'll hide a couple of {@link Entity}s and save a snapshot of the visual states of all its Entitys in an ModelMemento. Then we'll show all the Entitys
 * again, and then we'll restore the visual states of all the Entitys again from the ModelMemento, which will hide those two Entitys again.
 *
 * ## See Also
 *
 * * {@link CameraMemento} - Saves and restores the state of a {@link Scene}'s {@link Camera}.
 * * {@link ViewObjectsMemento} - Saves and restores a snapshot of the visual state of the {@link Entity}'s that represent objects within a {@link Scene}.
 *
 * ````javascript
 * import {Viewer, TreeViewPlugin,  ModelMemento} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *     canvasId: "myCanvas"
 * });
 *
 * // Load a model
 * const xktLoader = new TreeViewPlugin(viewer);
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
 *      viewer.scene.objects["0u4wgLe6n0ABVaiXyikbkA"].visible = false;
 *      viewer.scene.objects["3u4wgLe3n0AXVaiXyikbYO"].visible = false;
 *
 *      // Save memento of all object states, which includes those two hidden objects
 *      const ModelMemento = new ModelMemento();
 *
 * const dataModel = viewer.data.models
 *      ModelMemento.saveObjects(viewer.scene);
 *
 *      // Show all objects
 *      viewer.scene.setObjectsVisible(viewer.scene.objectIds, true);
 *
 *      // Restore the objects states again, which involves hiding those two objects again
 *      ModelMemento.restoreViewObjects(viewer.scene);
 * });
 * `````
 *
 * ## Masking Saved State
 *
 * We can optionally supply a mask to focus what state we save and restore.
 *
 * For example, to save and restore only the {@link Entity#visible} and {@link Entity#clippable} states:
 *
 * ````javascript
 * ModelMemento.saveObjects(viewer.scene, {
 *     visible: true,
 *     clippable: true
 * });
 *
 * //...
 *
 * // Restore the objects states again
 * ModelMemento.restoreViewObjects(viewer.scene);
 * ````
 */
class ModelMemento {
    #viewObjectsVisible: boolean[];
    #viewObjectsEdges: boolean[];
    #viewObjectsXRayed: boolean[];
    #viewObjectsHighlighted: boolean[];
    #viewObjectsSelected: boolean[];
    #viewObjectsClippable: boolean[];
    #viewObjectsPickable: boolean[];
    #viewObjectsColorize: number[];
    #viewObjectsOpacity: number[];
    #numViewObjects: number;

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
     * Creates a ModelMemento.
     */
    constructor() {
        this.#viewObjectsVisible = [];
        this.#viewObjectsEdges = [];
        this.#viewObjectsXRayed = [];
        this.#viewObjectsHighlighted = [];
        this.#viewObjectsSelected = [];
        this.#viewObjectsClippable = [];
        this.#viewObjectsPickable = [];
        this.#viewObjectsColorize = [];
        this.#viewObjectsOpacity = [];
        this.#numViewObjects = 0;
    }

    /**
     * Saves a snapshot of the visual state of the {@link ViewObject}'s that represent objects within a model.
     *
     * @param view The View.
     * @param {DataModel} dataModel Represents the model. Corresponds with an {@link ViewObject} that represents the model in the view.
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
    saveObjects(view: View, dataModel: DataModel, mask?: {
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

        const rootDataObject = dataModel.rootDataObject;
        if (!rootDataObject) {
            return;
        }

        const objectIds = rootDataObject.getObjectIdsInSubtree();

        this.#numViewObjects = 0;

        this.#mask = mask ? apply(mask, {}) : null;

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

        for (let i = 0, len = objectIds.length; i < len; i++) {
            const objectId = objectIds[i];
            const object = objects[objectId];
            if (!object) {
                continue;
            }
            if (visible) {
                this.#viewObjectsVisible[i] = object.visible;
            }
            if (edges) {
                this.#viewObjectsEdges[i] = object.edges;
            }
            if (xrayed) {
                this.#viewObjectsXRayed[i] = object.xrayed;
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
                this.#viewObjectsColorize[i * 3 + 0] = objectColor[0];
                this.#viewObjectsColorize[i * 3 + 1] = objectColor[1];
                this.#viewObjectsColorize[i * 3 + 2] = objectColor[2];
            }
            if (opacity) {
                this.#viewObjectsOpacity[i] = object.opacity;
            }
            this.#numViewObjects++;
        }
    }

    /**
     * Restores a {@link View}'s {@link ViewObject}'s to their state previously captured with {@link ModelMemento#saveObjects}.
     *
     * Assumes that the model has not been destroyed or modified since saving.
     *
     * @param view The View that was given to {@link ModelMemento#saveObjects}.
     * @param {DataModel} dataModel The metamodel that was given to {@link ModelMemento#saveObjects}.
     */
    restoreViewObjects(view: View, dataModel: DataModel) {

        const rootDataObject = dataModel.rootDataObject;
        if (!rootDataObject) {
            return;
        }

        const objectIds = rootDataObject.getObjectIdsInSubtree();

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

        const objects = view.objects;

        for (let i = 0, len = objectIds.length; i < len; i++) {
            const objectId = objectIds[i];
            const object = objects[objectId];
            if (!object) {
                continue;
            }
            if (visible) {
                object.visible = this.#viewObjectsVisible[i];
            }
            if (edges) {
                object.edges = this.#viewObjectsEdges[i];
            }
            if (xrayed) {
                object.xrayed = this.#viewObjectsXRayed[i];
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
                color[0] = this.#viewObjectsColorize[i * 3 + 0];
                color[1] = this.#viewObjectsColorize[i * 3 + 1];
                color[2] = this.#viewObjectsColorize[i * 3 + 2];
                object.colorize = color;
            }
            if (opacity) {
                object.opacity = this.#viewObjectsOpacity[i];
            }
        }
    }
}

export {ModelMemento};