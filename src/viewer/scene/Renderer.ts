import * as math from "../math/index";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {View} from "../view/View";
import {ViewerCapabilities} from "../ViewerCapabilities";
import {SceneModelParams} from "./SceneModelParams";
import {Viewer} from "../Viewer";

/**
 * Creates and renders geometry and materials for a {@link Viewer}.
 *
 * A Viewer has a single implementation of this type, which wraps an available browser 3D graphics API, such as WebGL or WebGPU.
 *
 * You don't normally want to touch this, unless you're configuring a custom allocation/rendering strategy for your Viewer
 *
 * ## Usage
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer,
 *     renderer: new MyRenderer({ ... })
 * });
 * ````
 */
export interface Renderer {

    /**
     * Initializes this Renderer.
     *
     * @param viewer
     */
    init(viewer:Viewer): void;

    /**
     * Gets the capabilities of this Renderer.
     */
    getCapabilities(capabilities: ViewerCapabilities) :void;

    /**
     * Gets whether this Renderer supports SAO.
     */
    getSAOSupported(): boolean;

    /**
     * Registers a {@link View} with this Renderer.
     *
     * The Renderer will then begin rendering each {@link SceneModel} created with {@link SceneModel.createModel} for the new View.
     *
     * @param view The View.
     * @returns A handle for the View within this Renderer.
     */
    registerView(view: View): number;

    /**
     * Deregisters the {@link View} with the given handle.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @param viewIndex
     */
    deregisterView(viewIndex: number): void;

    /**
     * Returns a new {@link SceneModel} that will be stored and rendered by this Renderer.
     *
     * The SceneModel provides an interface through which we can then build geometry and materials within
     * it. Once we've built the SceneModel and called {@link SceneModel.finalize}, the Renderer will immediately begin
     * rendering it all {@link View}s that we registered previously with {@link Renderer.registerView}.
     *
     * When we've finished with the SceneModel, we then call {@link SceneModel.destroy} to destroy it.
     *
     * @param params SceneModel creation params
     */
    createModel(params: SceneModelParams): SceneModel;

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
