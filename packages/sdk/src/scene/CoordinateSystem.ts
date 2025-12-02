
import {type FloatArrayParam} from "../math";
import {type CoordinateSystemParams} from "./CoordinateSystemParams";
import {Scene} from "./Scene";
import {SceneModel} from "./SceneModel";
import {createVec3, testOrthogonalAxis} from "../matrix";
import {SDKErrorType} from "../core";



/**
 * Represents a 3D coordinate system.
 *
 * A `CoordinateSystem` defines a spatial reference frame using a 3x3 basis matrix and an origin point in global space.
 * It also supports various unit systems and an optional scale-to-meters factor for unit normalization.
 *
 * Used by {@link Scene} and {@link SceneModel} components to define and manage spatial context for scene content.
 *
 * This class emits change events (via its Scene or SceneModel) for updates to its `basis`, `origin`, `units`, and
 * `scaleToMeters` properties, as well as a general `onUpdated` event whenever any of these properties change. The directional vectors `worldUp`, `worldRight`,
 * and `worldForward` are derived from the basis and represent the orientation of the coordinate system in world space.
 */
export class CoordinateSystem  {

    #notifyUpdatedScheduled: boolean;

    private _scene: Scene;
    private _model: SceneModel;
    private _basis: FloatArrayParam;
    private _origin: FloatArrayParam;
    private _units: 'meters' | 'millimeters' | 'inches' | 'feet';
    private _scaleToMeters?: number;
    private _worldUp: FloatArrayParam;
    private _worldRight: FloatArrayParam;
    private _worldForward: FloatArrayParam;

    /**
     * True if this CoordinateSystem has been destroyed.
     */
    public destroyed: boolean = false;

    /**
     * @private
     */
    constructor(parent: Scene | SceneModel, params?: CoordinateSystemParams) {
        if (parent instanceof Scene) {
            this._scene = parent;
        } else {
            this._model = parent;
        }
        this._origin = new Float64Array(<any>params?.origin || [0, 0, 0]);
        this._units = params?.units || "meters";
        this._scaleToMeters = params?.scaleToMeters || 1;
        this._worldUp = createVec3();
        this._worldRight = createVec3();
        this._worldForward = createVec3();

        this.basis = params?.basis;
    }

    #notifyUpdated() {
        if (!this.#notifyUpdatedScheduled) {
            this.#notifyUpdatedScheduled = true;
            setTimeout(() => {
                this.#notifyUpdatedScheduled = false;
                (this._model)
                    ? this._model.scene.events.onSceneModelCoordSystemUpdated.dispatch(this._model, this)
                    :  this._scene.events.onSceneCoordSystemUpdated.dispatch(this._scene, this);
            }, 100)
        }
    }

    /** Gets the flat 9-element coordinate system basis (column-major). */
    get basis(): FloatArrayParam {
        return this._basis;
    }

    /**
     * Sets the flat 9-element coordinate system basis (column-major).
     * Emits event on change, via `Scene.events.coordSystemBasis` or `SceneModel.events.modelCoordSystemBasis`.
     */
    set basis(value: FloatArrayParam) {
        if (this.destroyed) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.basis] CoordinateSystem already destroyed - cannot set basis"
            });
        }
        if (value && value.length !== 9) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.basis] Invalid basis array - must have 9 elements"
            });
        }
        if (!testOrthogonalAxis(value)) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.basis] Invalid basis array - axes are not orthogonal"
            });
        }
        this._basis = new Float32Array(<any>value || [
            1, 0, 0, // Right
            0, 0, 1, // Up
            0, 1, 0 // Forward
        ]);
        this._worldRight[0] = this._basis[0];
        this._worldRight[1] = this._basis[1];
        this._worldRight[2] = this._basis[2];
        this._worldUp[0] = this._basis[3];
        this._worldUp[1] = this._basis[4];
        this._worldUp[2] = this._basis[5];
        this._worldForward[0] = this._basis[6];
        this._worldForward[1] = this._basis[7];
        this._worldForward[2] = this._basis[8];
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemBasisChanged.dispatch(this._model, this)
            :  this._scene.events.onSceneCoordSystemBasisChanged.dispatch(this._scene, this);
        this.#notifyUpdated();
    }

    /** Gets the origin of the coordinate system in global space. */
    get origin(): FloatArrayParam {
        return this._origin;
    }

    /**
     * Sets the origin of the coordinate system in global space.
     * Emits event on change, via `Scene.events.coordSystemOrigin` or `SceneModel.events.modelCoordSystemOrigin`.
     */
    set origin(value: FloatArrayParam) {
        if (this.destroyed) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.origin] CoordinateSystem already destroyed - cannot set origin"
            });
        }
        this._origin = new Float32Array(<any>value);
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemOriginChanged.dispatch(this._model, this)
            :  this._scene.events.onSceneCoordSystemOriginChanged.dispatch(this._scene, this);
        this.#notifyUpdated();
    }

    /** Gets the unit system used. */
    get units(): 'meters' | 'millimeters' | 'inches' | 'feet' {
        return this._units;
    }

    /**
     * Sets the unit system used.
     * Emits event on change, via `Scene.events.coordSystemUnits` or `SceneModel.events.modelCoordSystemUnits`.
     */
    set units(value: 'meters' | 'millimeters' | 'inches' | 'feet') {
        if (this.destroyed) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.units] CoordinateSystem already destroyed - cannot set units"
            });
        }
        if (value !== 'meters' && value !== 'millimeters' && value !== 'inches' && value !== 'feet') {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.units] Invalid units - must be 'meters', 'millimeters', 'inches', or 'feet'"
            });
        }
        this._units = value;
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemUnitsChanged.dispatch(this._model, this)
            :  this._scene.events.onSceneCoordSystemUnitsChanged.dispatch(this._scene, this);
        this.#notifyUpdated();
    }

    /** Gets the optional scale-to-meters multiplier. */
    get scaleToMeters(): number | undefined {
        return this._scaleToMeters;
    }

    /**
     * Sets the optional scale-to-meters multiplier.
     * Emits event on change, via `Scene.events.coordSystemMeters` or `SceneModel.events.modelCoordSystemMeters`.
     */
    set scaleToMeters(value: number | undefined) {
        if (this.destroyed) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.scaleToMeters] CoordinateSystem already destroyed - cannot set scaleToMeters"
            });
        }
        if (value !== undefined && (typeof value !== "number" || isNaN(value) || value <= 0) ) {
            return (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.scaleToMeters] Invalid scaleToMeters - must be a positive number"
            });
        }
        this._scaleToMeters = value;
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemScaleToMetersChanged.dispatch(this._model, this)
        :  this._scene.events.onSceneCoordSystemScaleToMetersChanged.dispatch(this._scene, this);
        this.#notifyUpdated();
    }

    /**
     * Gets the direction of World-space "up".
     *
     * This is set by {@link CoordinateSystem.basis}.
     *
     * Default value is ````[0,0,1]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldUp(): FloatArrayParam {
        return this._worldUp;
    }

    /**
     * Gets the direction of World-space "right".
     *
     * This is set by {@link CoordinateSystem.basis}.
     *
     * Default value is ````[1,0,0]````.
     *
     * @returns {Number[]} The "right" vector.
     */
    get worldRight(): FloatArrayParam {
        return this._worldRight;
    }

    /**
     * Gets the direction of World-space "forwards".
     *
     * This is set by {@link CoordinateSystem.basis}.
     *
     * Default value is ````[0,0,-1]````.
     *
     * @returns {Number[]} The "forwards" vector.
     */
    get worldForward(): FloatArrayParam {
        return this._worldForward;
    }

    /**
     * Gets if the World-space X-axis is "up".
     * @returns {boolean}
     */
    get xUp(): boolean {
        return this._worldUp[0] > this._worldUp[1] && this._worldUp[0] > this._worldUp[2];
    }

    /**
     * Gets if the World-space Y-axis is "up".
     * @returns {boolean}
     */
    get yUp(): boolean {
        return this._worldUp[1] > this._worldUp[0] && this._worldUp[1] > this._worldUp[2];
    }

    /**
     * Gets if the World-space Z-axis is "up".
     * @returns {boolean}
     */
    get zUp(): boolean {
        return this._worldUp[2] > this._worldUp[0] && this._worldUp[2] > this._worldUp[1];
    }

    /**
     * Returns a copy of the current state as a CoordinateSystemParams object.
     */
    toParams(): CoordinateSystemParams {
        return {
            basis: Array.from(this._basis),
            origin: Array.from(this._origin),
            units: this._units,
            scaleToMeters: this._scaleToMeters
        };
    }

    /**
     * Updates this instance's state from a CoordinateSystemParams object.
     */
    fromParams(params: CoordinateSystemParams): void {
        if (this.destroyed) {
             (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.fromParams] CoordinateSystem already destroyed - cannot call fromParams"
            });
             return;
        }
        this._basis = new Float32Array(params.basis);
        this._origin = new Float64Array(params.origin);
        this._units = params.units;
        this._scaleToMeters = params.scaleToMeters;
        this.#notifyUpdated();
    }

    /**
     * Destroys this CoordinateSystem.
     * @private
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
    }
}
