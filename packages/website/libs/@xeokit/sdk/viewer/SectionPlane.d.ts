import { Component, EventEmitter } from "../core";
import type { View } from "./View";
import type { FloatArrayParam } from "../math";
import { SectionPlaneParams } from "./SectionPlaneParams";
/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * * Belongs to a {@link View | View}.
 * * Registered by {@link SectionPlane.id} in {@link View.sectionPlanes}.
 * * Slices portions off {@link ViewObject | ViewObjects} to create cross-section views or reveal interiors.
 * * Indicates its World-space position in {@link SectionPlane.pos} and orientation vector in {@link SectionPlane.dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane.dir}.
 * * Can be be enabled or disabled via {@link SectionPlane.active}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
declare class SectionPlane extends Component {
    #private;
    /**
     ID of this SectionPlane, unique within the {@link View}.
     */
    id: string;
    /**
     * The View to which this SectionPlane belongs.
     *
     * @property view
     * @type {View}
     *
     */
    readonly view: View;
    /**
     * Emits an event each time {@link SectionPlane.pos} changes.
     *
     * @event
     */
    readonly onPos: EventEmitter<SectionPlane, FloatArrayParam>;
    /**
     * Emits an event each time {@link SectionPlane.dir} changes.
     *
     * @event
     */
    readonly onDir: EventEmitter<SectionPlane, FloatArrayParam>;
    /**
     * Emits an event each time {@link SectionPlane.active} changes.
     *
     * @event
     */
    readonly onActive: EventEmitter<SectionPlane, boolean>;
    /**
     * @private
     *
     */
    constructor(view: View, sectionPlaneParams?: SectionPlaneParams);
    /**
     * Gets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @returns Returns ````true```` if active.
     */
    get active(): boolean;
    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */
    set active(value: boolean);
    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
    get pos(): FloatArrayParam;
    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */
    set pos(value: FloatArrayParam);
    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
    get dir(): FloatArrayParam;
    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */
    set dir(value: FloatArrayParam);
    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
    get dist(): number;
    /**
     * Inverts the direction of {@link SectionPlane.dir}.
     */
    flipDir(): void;
    /**
     * COnfigures this SectionPlane.
     *
     * @param sectionPlaneParams
     */
    fromParams(sectionPlaneParams: SectionPlaneParams): void;
    /**
     * Gets the current configuration of this SectionPlane.
     */
    toParams(): SectionPlaneParams;
    /**
     * Destroys this SectionPlane.
     */
    destroy(): void;
}
export { SectionPlane };
//# sourceMappingURL=SectionPlane.d.ts.map
