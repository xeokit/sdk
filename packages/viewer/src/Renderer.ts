import type {View} from "./View";
import type {Viewer} from "./Viewer";
import {FloatArrayParam} from "@xeokit/math/math";
import {Capabilities, Model, ModelParams, XKTObject} from "@xeokit/core/components";
import {ViewObject} from "./ViewObject";

/**
 * Manages storage and rendering of meshes for objects in a {@link @xeokit/viewer!Viewer}.
 *
 * Used by a Viewer internally, to allocate and render geometry and materials using a browser 3D graphics API (eg. WebGL, WebGPU).
 *
 * ## Usage
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new MyRenderer({ })
 * });
 * ````
 *
 * @category Advanced Use
 */
export interface Renderer {

    /**
     * Initializes this Renderer.
     *
     * @param viewer
     */
    init(viewer: Viewer): void;

    /**
     * Gets the capabilities of this Renderer.
     */
    getCapabilities(capabilities: Capabilities): void;

    /**
     * Gets whether this Renderer supports SAO.
     */
    getSAOSupported(): boolean;

    /**
     * Registers a {@link @xeokit/viewer!View} with this Renderer.
     *
     * The Renderer will then begin rendering each {@link @xeokit/viewer!Model | Model} created with {@link Model.createModel} for the new View.
     *
     * You can only register as many Views as indicated in {@link Capabilities.maxViews}, as returned by {@link Renderer.getCapabilities}.
     *
     * @param view The View.
     * @returns A handle for the View within this Renderer.
     */
    registerView(view: View): number;

    /**
     * Deregisters the {@link @xeokit/viewer!View} with the given handle.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @param viewIndex
     */
    deregisterView(viewIndex: number): void;

    /**
     * Returns a new {@link @xeokit/viewer!Model | Model} that will be stored and rendered by this Renderer.
     *
     * The Model provides an interface through which we can then build geometry and materials within
     * it. Once we've built the Model and called {@link Model.build}, the Renderer will immediately begin
     * rendering it all {@link View|Views} that we registered previously with {@link Renderer.registerView}.
     *
     * When we've finished with the Model, we then call {@link Model.destroy} to destroy it.
     *
     * @param params Model creation params
     */
    createModel(params: ModelParams): Model;

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
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void;

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
     * Sets TODO.
     */
    needsRebuild(viewIndex: number): void;

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
     * Picks a ViewerObject within a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Picking params.
     */
    pickSceneObject(viewIndex: number, params: {}): ViewObject | null;
}
