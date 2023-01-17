import type { View } from "../View";
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
 * In the example below, we'll create a {@link WebViewer} and use an {@link TreeViewPlugin} to load an ````.xkt```` model. When the model has loaded, we'll hide a couple of {@link ViewObject|ViewObjects} and save a snapshot of the visual states of all the ViewObjects in an ViewObjectsMemento. Then we'll show all the ViewObjects
 * again, and then we'll restore the visual states of all the ViewObjects again from the ViewObjectsMemento, which will hide those two ViewObjects again.
 *
 * ````javascript
 * import {WebViewer, TreeViewPlugin, ViewObjectsMemento} from "xeokit-viewer.es.js";
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
declare class ViewObjectsMemento {
    #private;
    numObjects: number;
    /**
     * Creates an ViewObjectsMemento.
     */
    constructor();
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
    }): void;
    /**
     * Restores a {@link View}'s {@link ViewObject}'s to their state previously captured with {@link ViewObjectsMemento#saveObjects}.
     * @param view The view.
     */
    restoreViewObjects(view: View): void;
}
export { ViewObjectsMemento };
