import type {EdgesParams} from "./EdgesParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {createVec3Float64, type Vec3} from "../../base/math/vector";


/**
 * Configures edge enhancement effect for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.edges}, which lives at {@link View.effects}.
 * * Disabled by default. Set {@link Edges.enabled | enabled} to `true`
 *   or pass `effects: {edges: {enabled: true}}` when creating a View.
 *
 * See {@link viewing!viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
class Edges {

    /**
     * The View to which this Edges belongs.
     */
    public readonly view: View;

    private _edgeColor: Vec3;
    private _useMeshColor: boolean;
    private _edgeDarken: number;
    private _edgeWidth: number;
    private _edgeAlpha: number;
    private _edgeFadeStart: number;
    private _edgeFadeEnd: number;
  private _enabled: boolean;
    private _destroyed = false;

    /**
     * @private
     */
    constructor(view: View, options: EdgesParams = {}) {

        this.view = view;
    this._enabled = options.enabled === true;
        this._edgeColor = createVec3Float64(options.edgeColor || [0.35, 0.35, 0.35]);
        this._useMeshColor = options.useMeshColor !== false;
        this._edgeDarken = (options.edgeDarken !== undefined && options.edgeDarken !== null) ? options.edgeDarken : 0.5;
        this._edgeAlpha = (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.8;
        this._edgeWidth = (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1;
        this._edgeFadeStart = (options.edgeFadeStart !== undefined && options.edgeFadeStart !== null) ? options.edgeFadeStart : 0.4;
        this._edgeFadeEnd = (options.edgeFadeEnd !== undefined && options.edgeFadeEnd !== null) ? options.edgeFadeEnd : 1.0;
    }

          set enabled(value: boolean) {
    const enabled = value === true;
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    this.view.needsRender();
  }

  get enabled(): boolean {
    return this._enabled;
  }

    /**
     * Sets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.35, 0.35, 0.35]````.
     */
    set edgeColor(value: Vec3) {
      if (!value || value.length < 3) {
        this.view.viewer.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[Edges set edgeColor] Invalid color parameter."
        });
        return;
      }
        const edgeColor = this._edgeColor;
        if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = value[0];
        edgeColor[1] = value[1];
        edgeColor[2] = value[2];
        this.view.needsRender();
    }

    /**
     * Gets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.35, 0.35, 0.35]````.
     */
    get edgeColor(): Vec3 {
        return this._edgeColor;
    }

    /**
     * Sets whether the base edges effect colours each edge with its own mesh's
     * colour darkened by {@link Edges.edgeDarken | edgeDarken}, instead of the
     * fixed {@link Edges.edgeColor | edgeColor}.
     *
     * Only affects the base edges effect — x-ray / highlight / selected edges
     * always use their emphasis material's colour.
     *
     * Default value is ````true````.
     */
    set useMeshColor(value: boolean) {
        if (this._useMeshColor === value) {
            return;
        }
        this._useMeshColor = value;
        this.view.needsRender();
    }

    /**
     * Gets whether the base edges effect uses each mesh's darkened colour
     * instead of the fixed {@link Edges.edgeColor | edgeColor}.
     *
     * Default value is ````true````.
     */
    get useMeshColor(): boolean {
        return this._useMeshColor;
    }

    /**
     * Sets the multiplier applied to each mesh's colour when
     * {@link Edges.useMeshColor | useMeshColor} is `true`.
     *
     * `0` yields black edges, `1` leaves the mesh colour unchanged.
     *
     * Default value is ````0.5````.
     */
    set edgeDarken(value: number) {
        if (this._edgeDarken === value) {
            return;
        }
        this._edgeDarken = value;
        this.view.needsRender();
    }

    /**
     * Gets the multiplier applied to each mesh's colour when
     * {@link Edges.useMeshColor | useMeshColor} is `true`.
     *
     * Default value is ````0.5````.
     */
    get edgeDarken(): number {
        return this._edgeDarken;
    }

    /**
     * Sets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````0.8````.
     */
    set edgeAlpha(value: number) {
        if (this._edgeAlpha === value) {
            return;
        }
        this._edgeAlpha = value;
        this.view.needsRender();
    }

    /**
     * Gets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````0.8````.
     */
    get edgeAlpha(): number {
        return this._edgeAlpha;
    }

    /**
     * Sets edge width for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number) {
        if (this._edgeWidth === value) {
            return;
        }
        this._edgeWidth = value;
        this.view.needsRender();
    }

    /**
     * Gets edge width for {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number {
        return this._edgeWidth;
    }

    /**
     * Sets the fraction of the active camera's far plane at which edge
     * fade-out begins.
     *
     * Smoothly attenuates edge alpha with view-space depth so distant edges
     * stop crowding into a dark mass — most visible in x-ray and silhouette
     * modes. Edges closer than this remain at full intensity. Range is
     * `[0, 1]`; set this `>= edgeFadeEnd` to disable the fade.
     *
     * Default value is ````0.4````.
     */
    set edgeFadeStart(value: number) {
        if (this._edgeFadeStart === value) {
            return;
        }
        this._edgeFadeStart = value;
        this.view.needsRender();
    }

    /**
     * Gets the fraction of the active camera's far plane at which edge
     * fade-out begins.
     *
     * Default value is ````0.4````.
     */
    get edgeFadeStart(): number {
        return this._edgeFadeStart;
    }

    /**
     * Sets the fraction of the active camera's far plane at which edges
     * become fully transparent.
     *
     * Default value is ````1.0````.
     */
    set edgeFadeEnd(value: number) {
        if (this._edgeFadeEnd === value) {
            return;
        }
        this._edgeFadeEnd = value;
        this.view.needsRender();
    }

    /**
     * Gets the fraction of the active camera's far plane at which edges
     * become fully transparent.
     *
     * Default value is ````1.0````.
     */
    get edgeFadeEnd(): number {
        return this._edgeFadeEnd;
    }

    /**
     * Gets if edges are currently applied.
     *
     * This is `true` when the component enabled state is
     * in the component enabled state.
     */
    get applied(): boolean {
    return this._enabled;
  }

    /**
     * Gets the current configuration of this Edges effect.
     */
    toParams(): SDKResult<EdgesParams> {
        return {
          ok: true,
          value:{
        enabled: this._enabled,
            edgeColor: <Vec3> Array.from(this.edgeColor),
            useMeshColor: this.useMeshColor,
            edgeDarken: this.edgeDarken,
            edgeWidth: this.edgeWidth,
            edgeAlpha: this.edgeAlpha,
            edgeFadeStart: this.edgeFadeStart,
            edgeFadeEnd: this.edgeFadeEnd
        }
        };
    }

    /**
     * Configures this Edges effect.
     *
     * @param edgesParams
     */
    fromParams(edgesParams: EdgesParams) : SDKResult<any> {
        if (this._destroyed) {
            return this.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[Edges.fromParams] Edges has been destroyed."
            });
        }
        // Each field is applied only when present, so single-key patches
        // (e.g. from the Studio config panel's `fromParams({useMeshColor})`)
        // don't clobber — or throw on — the fields they omit.
        if (edgesParams.enabled !== undefined) {
            this.enabled = edgesParams.enabled;
        }
        if (edgesParams.edgeColor !== undefined) {
            this.edgeColor = <Vec3>Array.from(edgesParams.edgeColor);
        }
        if (edgesParams.useMeshColor !== undefined) {
            this.useMeshColor = edgesParams.useMeshColor;
        }
        if (edgesParams.edgeDarken !== undefined) {
            this.edgeDarken = edgesParams.edgeDarken;
        }
        if (edgesParams.edgeWidth !== undefined) {
            this.edgeWidth = edgesParams.edgeWidth;
        }
        if (edgesParams.edgeAlpha !== undefined) {
            this.edgeAlpha = edgesParams.edgeAlpha;
        }
        if (edgesParams.edgeFadeStart !== undefined) {
            this.edgeFadeStart = edgesParams.edgeFadeStart;
        }
        if (edgesParams.edgeFadeEnd !== undefined) {
            this.edgeFadeEnd = edgesParams.edgeFadeEnd;
        }
        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * @private
     */
    destroy() {
        this._destroyed = true;
    }
}

export {Edges};
