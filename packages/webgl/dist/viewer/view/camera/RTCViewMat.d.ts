import type { FloatArrayParam } from "../../math/index";
import type { Camera } from "./Camera";
/**
 * Viewing matrix for a 3D relative-to-center (RTC) coordinate system origin.
 *
 * These aree normally only used internally, within {@link Renderer} implementations.
 *
 * These are created and destroyed by {@link Camera.getRTCViewMat} and {@link Camera.putRTCViewMat}.
 *
 * This class provides a version of {@link Camera.viewMatrix} that's dynamically adjusted
 * for a given RTC coordinate origin, that special shaders will use to render objects within
 * that RTC coordinate system. We use this technique to emulate double precision rendering on
 * single precision GPUs.
 *
 * {@link RTCViewMat.origin} indicates the origin of a 3D relative-to-center (RTC) coordinate
 * system. RTCViewMat dynamically calculates {@link RTCViewMat.viewMatrix} from {@link Camera.viewMatrix}, to provide a
 * viewing transform matrix that the shaders will use to render objects whose vertex coordinates are relative
 * to that RTC origin.
 */
export declare class RTCViewMat {
    #private;
    /**
     * ID of this RTC coordinate system.
     */
    readonly id: string;
    /**
     * The Camera.
     */
    readonly camera: Camera;
    /**
     * The origin of this RTC coordinate system.
     */
    readonly origin: Float64Array;
    /**
     * @private
     */
    useCount: number;
    /**
     * @private
     */
    dirty: boolean;
    /**
     * @private
     * @param camera
     * @param id
     * @param origin
     */
    constructor(camera: Camera, id: string, origin: FloatArrayParam);
    /**
     * Gets the view matrix for this RTC coordinate system.
     */
    get viewMatrix(): FloatArrayParam;
    /**
     * Releases this RTCViewMat.
     *
     * Equivalent to calling {@link Camera.putRTCViewMat}.
     */
    release(): void;
}
