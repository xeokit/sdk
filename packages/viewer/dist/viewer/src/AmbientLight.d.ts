import { Component } from "@xeokit/core";
import type { View } from "./View";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * An ambient light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Has fixed color and intensity that illuminates all objects equally.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
declare class AmbientLight extends Component {
    #private;
    /**
     ID of this AmbientLight, unique within the {@link @xeokit/viewer!View}.
     */
    id: string;
    /**
     * The View to which this AmbientLight belongs.
     */
    readonly view: View;
    /**
     * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
     * @param cfg AmbientLight configuration
     */
    constructor(view: View, cfg?: {
        /** Optional ID, generated automatically when omitted.*/
        id?: string;
        /** Intensity factor in range ````[0..1]````.  Default is ````1````.*/
        intensity?: number;
        /** RGB color in range ````[0..1,0..1,0..1]````. Default is ````[0.7, 0.7, 0.7]````.*/
        color?: FloatArrayParam;
    });
    /**
     * Sets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     *
     * @param color The AmbientLight's RGB color.
     */
    set color(color: FloatArrayParam);
    /**
     * Gets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     */
    get color(): FloatArrayParam;
    /**
     * Sets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @param intensity The AmbientLight's intensity.
     */
    set intensity(intensity: number);
    /**
     * Gets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The AmbientLight's intensity.
     */
    get intensity(): number;
    /**
     * Destroys this AmbientLight.
     */
    destroy(): void;
}
export { AmbientLight };
