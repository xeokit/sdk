
import {type CoordinateSystemParams} from "./CoordinateSystemParams";
import  {Scene} from "./Scene";
import type {SceneModel} from "./SceneModel";
import {
  createVec3Float32,
  createVec9Float64,
  type Vec3,
  type Vec9,
  testOrthogonalAxis,
  createVec3Float64
} from "../math";
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

  /** @private */
    _notifyUpdatedScheduled: boolean;

    private _scene: Scene;
    private _model: SceneModel;
    private _basis: Vec9;
    private _origin: Vec3;
    private _units: 'meters' | 'millimeters' | 'inches' | 'feet';
    private _scaleToMeters?: number;
    private _worldUp: Vec3;
    private _worldRight: Vec3;
    private _worldForward: Vec3;

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
        this._origin = createVec3Float64(<any>params?.origin || [0, 0, 0]);
        this._units = params?.units || "meters";
        this._scaleToMeters = params?.scaleToMeters || 1;
        this._worldUp = createVec3Float32();
        this._worldRight = createVec3Float32();
        this._worldForward = createVec3Float32();

        this.basis = params?.basis;
    }

    /** @private */
    _notifyUpdated() {
        if (!this._notifyUpdatedScheduled) {
            this._notifyUpdatedScheduled = true;
            setTimeout(() => {
                this._notifyUpdatedScheduled = false;
                (this._model)
                    ? this._model.scene.events.onSceneModelCoordSystemUpdated.dispatch(this._model, this)
                    :  this._scene.events.onSceneCoordSystemUpdated.dispatch(this._scene, this);
            }, 100)
        }
    }

    /** Gets the flat 9-element coordinate system basis (column-major). */
    get basis(): Vec9 {
        return this._basis;
    }

    /**
     * Sets the flat 9-element coordinate system basis (column-major).
     * Emits event on change, via `Scene.events.coordSystemBasis` or `SceneModel.events.modelCoordSystemBasis`.
     */
    set basis(value: Vec9) {
        if (this.destroyed) {
             (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.basis] CoordinateSystem already destroyed - cannot set basis"
            });
             return;
        }
        if (value) {
          if (value.length !== 9) {
            (this._scene || this._model.scene).logError({
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: "[CoordinateSystem.basis] Invalid basis array - must have 9 elements"
            });
            return;
          }
          if (!testOrthogonalAxis(value)) {
            (this._scene || this._model.scene).logError({
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: "[CoordinateSystem.basis] Invalid basis array - axes are not orthogonal"
            });
            return;
          }
        }
        this._basis = createVec9Float64(<any>value || [
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
        this._notifyUpdated();
    }

    /** Gets the origin of the coordinate system in global space. */
    get origin(): Vec3 {
        return this._origin;
    }

    /**
     * Sets the origin of the coordinate system in global space.
     * Emits event on change, via `Scene.events.coordSystemOrigin` or `SceneModel.events.modelCoordSystemOrigin`.
     */
    set origin(value: Vec3) {
        if (this.destroyed) {
            (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.origin] CoordinateSystem already destroyed - cannot set origin"
            });
            return;
        }
        this._origin = createVec3Float32(value);
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemOriginChanged.dispatch(this._model, this)
            :  this._scene.events.onSceneCoordSystemOriginChanged.dispatch(this._scene, this);
        this._notifyUpdated();
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
            (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.units] CoordinateSystem already destroyed - cannot set units"
            });
            return;
        }
        if (value !== 'meters' && value !== 'millimeters' && value !== 'inches' && value !== 'feet') {
            (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.units] Invalid units - must be 'meters', 'millimeters', 'inches', or 'feet'"
            });
            return;
        }
        this._units = value;
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemUnitsChanged.dispatch(this._model, this)
            :  this._scene.events.onSceneCoordSystemUnitsChanged.dispatch(this._scene, this);
        this._notifyUpdated();
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
            (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[CoordinateSystem.scaleToMeters] CoordinateSystem already destroyed - cannot set scaleToMeters"
            });
            return;
        }
        if (value !== undefined && (typeof value !== "number" || isNaN(value) || value <= 0) ) {
            (this._scene||this._model.scene).logError({
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: "[CoordinateSystem.scaleToMeters] Invalid scaleToMeters - must be a positive number"
            });
            return;
        }
        this._scaleToMeters = value;
        (this._model)
            ? this._model.scene.events.onSceneModelCoordSystemScaleToMetersChanged.dispatch(this._model, this)
        :  this._scene.events.onSceneCoordSystemScaleToMetersChanged.dispatch(this._scene, this);
        this._notifyUpdated();
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
    get worldUp(): Vec3 {
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
    get worldRight(): Vec3 {
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
    get worldForward(): Vec3 {
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
            basis: <Vec9>Array.from(this._basis),
            origin: <Vec3>Array.from(this._origin),
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
        this._basis = createVec9Float64(params.basis);
        this._origin = createVec3Float32(params.origin);
        this._units = params.units;
        this._scaleToMeters = params.scaleToMeters;
        this._notifyUpdated();
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
