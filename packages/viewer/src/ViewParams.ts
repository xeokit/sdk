import type {FloatArrayParam} from "@xeokit/math";

/**
 * {@link @xeokit/viewer!View} creation parameters for {@link Viewer.createView}.
 */
export interface ViewParams {

    /**
     * ID for the new View.
     */
    id?: string;

    /**
     * The Real-space 3D origin, in Real-space units, at which the {@link @xeokit/viewer!View}'s World-space
     * coordinate origin ````[0,0,0]```` sits.
     */
    origin?: FloatArrayParam;

    /**
     * The number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     *
     * For example, if {@link @xeokit/viewer!ViewParams.units} is {@link @xeokit/constants!MetersUnit}, and there are ten meters per World-space coordinate
     * system unit, then this property would have a value of ````10.0````.
     */
    scale?: number;

    /**
     * The unit of measurement for the {@link @xeokit/viewer!View}. Accepted values are {@link @xeokit/constants!MetersUnit},
     * {@link @xeokit/constants!CentimetersUnit}, {@link @xeokit/constants!MillimetersUnit}, {@link @xeokit/constants!YardsUnit},
     * {@link @xeokit/constants!FeetUnit}
     * and {@link @xeokit/constants!InchesUnit}.
     */
    units?: number;

    /**
     * ID of an HTMLCanvasElement in the DOM.
     */
    elementId?: string;

    /**
     *
     */
    htmlElement?: HTMLCanvasElement;

    backgroundColor?: FloatArrayParam;

    backgroundColorFromAmbientLight?: boolean;

    premultipliedAlpha?: boolean;

    transparent?: boolean;

    pbrEnabled?: boolean;

    colorTextureEnabled?: boolean;

    edgesEnabled?: boolean;

    /**
     * Whether the {@link @xeokit/viewer!View} will automatically create {@link @xeokit/viewer!ViewLayer | ViewLayers} on-demand
     * as {@link @xeokit/viewer!ViewObject | ViewObjects} are created.
     *
     * When ````true```` (default), the {@link @xeokit/viewer!View} will automatically create {@link @xeokit/viewer!ViewLayer | ViewLayers} as needed for each new
     * {@link @xeokit/viewer!ViewObject.layerId | ViewObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
     * layerId. This default setting therefore ensures that a ViewObject is created in the {@link @xeokit/viewer!View} for every ViewerObject that is created.
     *
     * If you set this ````false````, however, then the {@link @xeokit/viewer!View} will only create {@link @xeokit/viewer!ViewObject | ViewObjects} for {@link @xeokit/viewer!ViewObject | ViewObjects} that have
     * a {@link @xeokit/viewer!ViewObject.layerId | ViewObject.layerId} that matches the ID of a {@link @xeokit/viewer!ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * ViewerObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for ViewerObjects
     * that it never needs to show.
     */
    autoLayers?: boolean;
}
