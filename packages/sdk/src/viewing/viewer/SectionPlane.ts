import {type Vec3, dotVec3, createVec3Float32, createVec3Float64} from "../../base/math/vector";
import {type SectionPlaneParams} from "./SectionPlaneParams";
import type {View} from "./View";
import {createUUID} from "../../base/utils";
import {SDKErrorType, type SDKResult} from "../../base/core";


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
 * See {@link viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
class SectionPlane {

    /**
     ID of this SectionPlane, unique within the {@link viewing!viewer.View | View}.
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
    private _capColor: Vec3 | null;

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
        this._dir = createVec3Float32(normalizeSectionPlaneDir(sectionPlaneParams.dir || [0, 0, -1], [0, 0, -1]));
        // Plane equation constant: dot(normal, point) + dist = 0,
        // so dist = -dot(pos, dir). Compute up front; the renderer
        // packs this as the `w` channel of each `uSectionPlanes[]`
        // entry and the FS test is a single dot+add against it.
        // Leaving this at zero (the previous default) made every
        // freshly-created plane behave as if it passed through the
        // world origin, regardless of `pos`.
        this._dist = -dotVec3(this._pos, this._dir);
        // null = no cap (back faces in the clipped region are
        // discarded normally). When set, back faces in the
        // clipped region survive and are coloured with this
        // value, giving a visible cross-section "fill" on the
        // cut surface.
        this._capColor = sectionPlaneParams.capColor
          ? createVec3Float32(sectionPlaneParams.capColor)
          : null;
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
        this.view.needsRender();
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
        this._dir.set(normalizeSectionPlaneDir(value, this._dir));
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
     * Per-plane "cap" colour. When `null` (the default), the
     * fragment shader treats this plane as a pure clipping
     * plane — back faces in the clipped half-space discard
     * along with front faces, leaving a visible cut-away.
     *
     * When set to an RGB triple, the shader keeps back-facing
     * fragments in the clipped region and colours them with
     * this value — producing a flat "fill" on the cut surface
     * that reads as a cross-section cap. Each section plane
     * can carry its own cap colour or none.
     *
     * The material's hatch pattern (if any) still applies on
     * top of the cap colour, so cross-sections of hatched
     * materials show their conventional fill — engineering-
     * standard masonry sections look like masonry, steel like
     * steel.
     */
    get capColor(): Vec3 | null {
      return this._capColor;
    }

    set capColor(value: Vec3 | null) {
      if (value === null) {
        if (this._capColor !== null) {
          this._capColor = null;
          this.view.needsRender();
        }
        return;
      }
      if (!value || value.length !== 3) return;
      if (!this._capColor) this._capColor = createVec3Float32([0, 0, 0]);
      this._capColor[0] = value[0];
      this._capColor[1] = value[1];
      this._capColor[2] = value[2];
      this.view.needsRender();
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

function normalizeSectionPlaneDir(value: Vec3, fallback: Vec3): Vec3 {
    const x = value[0], y = value[1], z = value[2];
    const len = Math.hypot(x, y, z);
    if (!Number.isFinite(len) || len < 1e-12) {
        return [fallback[0], fallback[1], fallback[2]];
    }
    return [x / len, y / len, z / len];
}
