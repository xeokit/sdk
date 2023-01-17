import type { DataModel } from "../../data/DataModel";
import type { View } from "../View";
/**
 * Saves and restores a snapshot of the visual state of the {@link ViewObject}'s of a model within a {@link Scene}.
 *
 * ## Usage
 *
 * In the example below, we'll create a {@link WebViewer} and use an {@link TreeViewPlugin} to load an ````.xkt```` model. When the model has loaded, we'll hide a couple of {@link Entity}s and save a snapshot of the visual states of all its Entitys in an ModelMemento. Then we'll show all the Entitys
 * again, and then we'll restore the visual states of all the Entitys again from the ModelMemento, which will hide those two Entitys again.
 *
 * ## See Also
 *
 * * {@link CameraMemento} - Saves and restores the state of a {@link Scene}'s {@link Camera}.
 * * {@link ViewObjectsMemento} - Saves and restores a snapshot of the visual state of the {@link Entity}'s that represent objects within a {@link Scene}.
 *
 * ````javascript
 * import {WebViewer, TreeViewPlugin,  ModelMemento} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
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
declare class ModelMemento {
    #private;
    /**
     * Creates a ModelMemento.
     */
    constructor();
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
    }): void;
    /**
     * Restores a {@link View}'s {@link ViewObject}'s to their state previously captured with {@link ModelMemento#saveObjects}.
     *
     * Assumes that the model has not been destroyed or modified since saving.
     *
     * @param view The View that was given to {@link ModelMemento#saveObjects}.
     * @param {DataModel} dataModel The metamodel that was given to {@link ModelMemento#saveObjects}.
     */
    restoreViewObjects(view: View, dataModel: DataModel): void;
}
export { ModelMemento };
