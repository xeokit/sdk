import type { CameraControl } from "./CameraControl";
/**
 * @private
 */
declare class PickController {
    #private;
    /**
     * Set true to schedule picking of an Entity.
     */
    schedulePickEntity: boolean;
    /**
     * Set true to schedule picking of a position on teh surface of an Entity.
     */
    schedulePickSurface: boolean;
    /**
     * The canvas position at which to do the next scheduled pick.
     */
    pickCursorPos: any;
    /**
     * Will be true after picking to indicate that something was picked.
     */
    picked: boolean;
    /**
     * Will be true after picking to indicate that a position on the surface of an Entity was picked.
     */
    pickedSurface: boolean;
    /**
     * Will hold the PickResult after after picking.
     */
    pickResult: any;
    constructor(cameraControl: CameraControl, configs: any);
    /**
     * Immediately attempts a pick, if scheduled.
     */
    update(): void;
    fireEvents(): void;
    destroy(): void;
}
export { PickController };
