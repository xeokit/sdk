import * as math from "../math/index";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {View} from "../view/View";
import {ViewerCapabilities} from "../ViewerCapabilities";
import {SceneModelParams} from "./SceneModelParams";
import {Viewer} from "../Viewer";

/**
 * Strategy used internally by a {@link Viewer} to allocate and render geometry and materials on top of a
 * given underlying Browser graphics API.
 *
 * You don't normally want to touch this, unless you're configuring a custom allocation/rendering strategy for your Viewer.
 *
 * ## Usage
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer,
 *     sceneRenderer: new MySceneRenderer({ ... })
 * });
 * ````
 */
export interface SceneRenderer {

    /**
     * Initializes this SceneRenderer.
     *
     * @param viewer
     */
    init(viewer:Viewer): void;

    /**
     * Gets the capabilities of this SceneRenderer.
     */
    getCapabilities(capabilities: ViewerCapabilities) :void;

    /**
     * Gets whether this SceneRenderer supports SAO.
     */
    getSAOSupported(): boolean;

    /**
     * Registers a {@link View} with this SceneRenderer.
     *
     * The SceneRenderer will then begin rendering each {@link SceneModel} created with {@link SceneModel.createSceneModel} for the new View.
     *
     * @param view The View.
     * @returns A handle for the View within this SceneRenderer.
     */
    registerView(view: View): number;

    /**
     * Deregisters the {@link View} with the given handle.
     *
     * The SceneRenderer will then cease rendering for that View.
     *
     * @param viewIndex
     */
    deregisterView(viewIndex: number): void;

    /**
     * Returns a new {@link SceneModel} that will be rendered by this SceneRenderer.
     *
     * Once we've built the SceneModel and called {@link SceneModel.finalize}, the SceneRenderer will begin rendering
     * it for each of the {@link View}s that we've registered previously with {@link SceneRenderer.registerView}.
     *
     * @param params SceneModel params
     */
    createSceneModel(params: SceneModelParams): SceneModel;

    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable transparent objects for the View.
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable edge enhancement for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable edges for the View.
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable SAO for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable SAO for the View.
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable PBR for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable PBR for the View.
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Set background color for the given View.
     *
     * @param viewIndex Index of the View.
     * @param color RGB background color.
     */
    setBackgroundColor(viewIndex: number, color: math.FloatArrayType): void;

    /**
     * Indicates that the renderer needs to render a new frame for the given View.
     */
    setImageDirty(viewIndex?: number): void;

    /**
     * Clears this renderer,
     * @param viewIndex
     */
    clear(viewIndex: number): any;

    /**
     * Gets if a new frame needs to be rendered for the given View.
     */
    needsRender(viewIndex: number): boolean;

    /**
     * Renders a frame for a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Rendering params.
     * @param [params.force=false] True to force a render, else only render if needed.
     */
    render(viewIndex: number, params: { force?: boolean; }): void;

    /**
     * Picks a SceneObject within a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Picking params.
     */
    pickSceneObject(viewIndex: number, params: {}): SceneObject;
}
