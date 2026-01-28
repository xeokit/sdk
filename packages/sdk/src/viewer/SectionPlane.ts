import {type Vec3, dotVec3, createVec3Float32, createVec3Float64} from "../math/vector";
import {type SectionPlaneParams} from "./SectionPlaneParams";
import type {View} from "./View";
import {createUUID} from "../utils";
import {SDKErrorType, type SDKResult} from "../core";


/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * * Belongs to a {@link View | View}.
 * * Registered by {@link SectionPlane.id} in {@link View.sectionPlanes}.
 * * Slices portions off {@link ViewObject | ViewObjects} to create cross-section views or reveal interiors.
 * * Indicates its World-space position in {@link SectionPlane.pos} and orientation vector in {@link SectionPlane.dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane.dir}.
 * * Can be enabled or disabled via {@link SectionPlane.active}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class SectionPlane {

    /**
     ID of this SectionPlane, unique within the {@link View}.
     */
    public id: string;

    /**
     * The View to which this SectionPlane belongs.
     *
     * @property view
     * @type {View}
     *
     */
    public readonly view: View;

    private _pos: Vec3;
    private _active: boolean;
    private _dist: number;
    private _dir: Vec3;

    /**
     * True once this SectionPlane has been destroyed.
     */
    public destroyed: boolean = false;

    /**
     * @private
     *
     */
    constructor(view: View, sectionPlaneParams: SectionPlaneParams = {}) {
        this.id = sectionPlaneParams.id || createUUID();
        this.view = view;
        this._active = sectionPlaneParams.active !== false;
        this._pos = createVec3Float64(sectionPlaneParams.pos || [0, 0, 0]);
        this._dir = createVec3Float32(sectionPlaneParams.pos || [0, 0, -1]);
        this._dist = 0;
    }

    /**
     * Gets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @returns Returns ````true```` if active.
     */
    get active(): boolean {
        return this._active;
    }

    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */
    set active(value: boolean) {
        if (this._active === value) {
            return;
        }
        this._active = value;
        this.view.needsRender();
        this.view.viewer.events.onSectionPlaneActive.dispatch(this, this._active);
    }

    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
    get pos(): Vec3 {
        return this._pos;
    }

    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */
    set pos(value: Vec3) {
      // @ts-ignore
        this._pos.set(value);
        this._dist = (-dotVec3(this._pos, this._dir));
        this.view.viewer.events.onSectionPlanePosChanged.dispatch(this, this._pos);
    }

    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
    get dir(): Vec3 {
        return this._dir;
    }

    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */
    set dir(value: Vec3) {
      // @ts-ignore
        this._dir.set(value);
        this._dist = (-dotVec3(this._pos, this._dir));
        this.view.needsRender();
        this.view.viewer.events.onSectionPlaneDirChanged.dispatch(this, this._dir);
    }

    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
    get dist(): number {
        return this._dist;
    }

    /**
     * Inverts the direction of {@link SectionPlane.dir}.
     */
    flipDir() {
        const dir = this._dir;
        dir[0] *= -1.0;
        dir[1] *= -1.0;
        dir[2] *= -1.0;
        this._dist = -dotVec3(this._pos, this._dir);
        this.view.viewer.events.onSectionPlaneDirChanged.dispatch(this, this._dir);
        this.view.needsRender();
    }

    /**
     * COnfigures this SectionPlane.
     *
     * @param sectionPlaneParams
     */
    fromParams(sectionPlaneParams: SectionPlaneParams) : SDKResult<void>{
      if (this.destroyed) {
          return this.view.viewer.logError({
            ok: false,
            type: SDKErrorType.InvalidOperation,
            error: "[SectionPlane.fromParams] SectionPlane has been destroyed.",
          });
      }
      if (sectionPlaneParams.dir) {
            this.dir = sectionPlaneParams.dir;
        }
        if (sectionPlaneParams.pos) {
            this.pos = sectionPlaneParams.pos;
        }
        if (sectionPlaneParams.active !== undefined) {
            this.active = sectionPlaneParams.active;
        }
        return {
          ok: true,
          value: null
        };
    }

    /**
     * Gets the current configuration of this SectionPlane.
     */
    toParams(): SDKResult<SectionPlaneParams> {
        return {
          ok: true,
          value: {
            id: this.id,
            dir: <Vec3>Array.from(this._dir),
            pos: <Vec3>Array.from(this._pos),
            active: this._active
          }
        };
    }

    /**
     * Destroys this SectionPlane.
     */
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.view._removeSectionPlane(this);
    }
}

export {SectionPlane};
