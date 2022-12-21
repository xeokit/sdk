import type {FloatArrayParam} from "./math";

/**
 * {@link View} creation parameters for {@link Viewer.createView}.
 */
export interface ViewParams {

    /**
     * ID for the new View.
     */
    id?: string;

    /**
     * The Real-space 3D origin, in Real-space units, at which the {@link View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
    origin?: FloatArrayParam;

    /**
     * The number of Real-space units represented by each unit of the {@link View}'s World-space coordinate system.
     *
     * For example, if {@link ViewParams.units} is {@link MetersUnit}, and there are ten meters per World-space coordinate
     * system unit, then this property would have a value of ````10.0````.
     */
    scale?: number;

    /**
     * The unit of measurement for the {@link View}. Accepted values are {@link MetersUnit}, {@link CentimetersUnit},
     * {@link MillimetersUnit}, {@link YardsUnit}, {@link FeetUnit} and {@link InchesUnit}.
     */
    units?: number;

    /**
     * ID of an HTMLCanvasElement in the DOM.
     */
    canvasId?: string;

    /**
     *
     */
    canvasElement?: HTMLCanvasElement;
    backgroundColor?: any[];
    backgroundColorFromAmbientLight?: boolean;
    premultipliedAlpha?: boolean;
    transparent?: boolean;
    pbrEnabled?: boolean;
    colorTextureEnabled?: boolean;

    /**
     * Whether the {@link View} will automatically create {@link ViewLayer|ViewLayers} on-demand
     * as {@link SceneObject|SceneObjects} are created.
     *
     * When ````true```` (default), the {@link View} will automatically create {@link ViewLayer|ViewLayers} as needed for each new
     * {@link SceneObject.viewLayerId} encountered, including a "default" ViewLayer for SceneObjects that have no
     * viewLayerId. This default setting therefore ensures that a ViewObject is created in the {@link View} for every SceneObject that is created.
     *
     * If you set this ````false````, however, then the {@link View} will only create {@link ViewObject|ViewObjects} for {@link SceneObject|SceneObjects} that have
     * a {@link SceneObject.viewLayerId} that matches the ID of a {@link ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * SceneObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for SceneObjects
     * that it never needs to show.
     */
    autoLayers?: boolean;
}