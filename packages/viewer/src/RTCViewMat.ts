import type {Camera} from "./Camera";
import {FloatArrayParam} from "@xeokit/math/math";
import {createMat4} from "@xeokit/math/matrix";
import {createRTCViewMat} from "@xeokit/math/rtc";

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
 *
 * @category Advanced Use
 */
export class RTCViewMat {

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

    #viewMatrix: FloatArrayParam;

    /**
     * @private
     * @param camera
     * @param id
     * @param origin
     */
    constructor(camera: Camera, id: string, origin: FloatArrayParam) {
        this.camera = camera;
        this.id = id;
        this.origin = new Float64Array(origin);
        this.#viewMatrix = createMat4();
        this.useCount = 0;
        this.dirty = true;
    }

    /**
     * Gets the view matrix for this RTC coordinate system.
     */
    get viewMatrix(): FloatArrayParam {
        if (this.dirty) {
            createRTCViewMat(this.camera.viewMatrix, this.origin, this.#viewMatrix);
            this.dirty = false;
        }
        return this.#viewMatrix;
    }

    /**
     * Releases this RTCViewMat.
     *
     * Equivalent to calling {@link Camera.putRTCViewMat}.
     */
    release(): void {
        this.camera.putRTCViewMat(this);
    }
}
