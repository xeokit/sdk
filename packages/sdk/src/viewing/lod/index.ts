/**
 * # Viewing LOD Representation Selection
 *
 * The `viewing.lod` module selects authored SceneModel representations on a
 * per-view basis. It does not generate shell geometry or create SceneModel
 * content. Shells, impostors and other LOD representations are authored in
 * `model.lod` and stored in {@link model!scene.SceneRepSet | SceneRepSet}
 * metadata.
 *
 * LOD suppression is separate from ordinary application visibility. Renderers
 * combine both states while drawing:
 *
 * ```text
 * effectiveVisible = applicationVisible && !lodSuppressed
 * ```
 *
 * Use {@link RepresentationLODSelector} to discover representation sets whose
 * selection metadata uses `"projectedSize"` and select one representation per
 * view.
 *
 * Representation selection is also the fast path for switching visibility of
 * large object groups. Instead of rewriting ordinary object visibility for
 * every object in a representation, the viewer records the selected
 * representation per View and lets renderers suppress non-selected
 * representation memberships at batch or draw-list granularity.
 *
 * ## Runtime Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class RepresentationLODSelector {
 *       +enabled
 *       +setEnabled(enabled)
 *       +updateView(view)
 *       +updateAllViews()
 *       +getActiveRepId(view, repSet)
 *       +clear()
 *       +destroy()
 *     }
 *     class LODVisibility {
 *       +isSuppressed(viewId, objectId)
 *       +setSuppressed(viewId, objectIds, suppressed)
 *       +setSelectedRep(viewId, selectionId, reps, selectedRepId)
 *       +getViewVersion(viewId)
 *     }
 *     RepresentationLODSelector ..> LODVisibility : suppresses non-selected reps
 * ```
 *
 * ## Basic Usage
 *
 * The selector works with representation sets already present in loaded
 * SceneModels. Those sets can be authored offline, generated with
 * {@link model!lod.createShellRep | model.lod.createShellRep}, or loaded from a
 * format such as XGF that preserves representation metadata.
 *
 * Create the selector after the Viewer exists:
 *
 * ```ts
 * import {RepresentationLODSelector} from "@xeokit/sdk/viewing/lod";
 *
 * const selector = new RepresentationLODSelector({
 *   viewer
 * });
 * ```
 *
 * The selector discovers eligible representation sets automatically. A set is
 * eligible when its selection metadata uses the projected-size strategy:
 *
 * ```ts
 * sceneModel.createRepSet({
 *   id: "floor3",
 *   defaultRepId: "detailed",
 *
 *   selection: {
 *     strategy: "projectedSize",
 *     hysteresisPixels: 16
 *   },
 *
 *   reps: [
 *     {
 *       id: "detailed",
 *       objectIds: [
 *         "wall1",
 *         "wall2",
 *         "slab1"
 *       ],
 *       range: {
 *         minPixels: 160
 *       }
 *     },
 *     {
 *       id: "shell",
 *       objectIds: [
 *         "__floor3_shell"
 *       ],
 *       range: {
 *         maxPixels: 128
 *       }
 *     }
 *   ]
 * });
 * ```
 *
 * After the set exists, camera and viewport changes update selection for each
 * View. Applications normally do not need to call `updateView()` manually.
 *
 * ## Loading a Model With Representations
 *
 * For a model format that restores SceneModel representation sets, create the
 * selector once and load the model normally:
 *
 * ```ts
 * const selector = new RepresentationLODSelector({viewer});
 *
 * const sceneModel = scene.createModel({
 *   id: "hospital"
 * }).value;
 *
 * await xgfLoader.load({
 *   fileData,
 *   sceneModel
 * });
 *
 * // Newly loaded representation sets are discovered automatically.
 * ```
 *
 * ## Inspecting Selection
 *
 * Use `getActiveRepId()` when UI or diagnostics need to show what a View is
 * currently using:
 *
 * ```ts
 * const repSet = sceneModel.repSets["floor3"];
 * const activeRepId = selector.getActiveRepId(view, repSet);
 * const mode = selector.getMode(view, repSet);
 *
 * console.log(activeRepId, mode);
 * ```
 *
 * `getMode()` returns:
 *
 * - `"default"` when the set's default representation is selected,
 * - `"selected"` when another representation is selected,
 * - `"invalid"` when the set cannot currently be evaluated.
 *
 * ## Enable, Disable and Destroy
 *
 * Disabling the selector clears only selector-owned representation suppression.
 * It does not change ordinary object visibility:
 *
 * ```ts
 * selector.setEnabled(false); // all representations are unsuppressed again
 * selector.setEnabled(true);  // selection resumes
 *
 * selector.destroy();         // clears suppression and removes event handlers
 * ```
 *
 * ## Multiple Views
 *
 * Selection state is per View. Two Views can show different representations of
 * the same SceneModel at the same time:
 *
 * ```ts
 * const nearView = viewer.viewList[0];
 * const farView = viewer.viewList[1];
 * const repSet = sceneModel.repSets["floor3"];
 *
 * selector.updateView(nearView);
 * selector.updateView(farView);
 *
 * console.log(selector.getActiveRepId(nearView, repSet)); // "detailed"
 * console.log(selector.getActiveRepId(farView, repSet));  // "shell"
 * ```
 *
 * @module lod
 */
export * from "./LODVisibility";
export * from "./RepresentationLODSelector";
export * from "./RepresentationLODSelectorParams";
