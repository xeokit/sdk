import { CameraControl } from "./CameraControl";
/**
 *
 * @private
 */
declare class PickController {
    #private;
    private schedulePickEntity;
    private schedulePickSurface;
    private scheduleSnapOrPick;
    private pickCursorPos;
    private picked;
    private pickedSurface;
    private pickResult;
    private snappedOrPicked;
    private hoveredSnappedOrSurfaceOff;
    private snapPickResult;
    constructor(cameraControl: CameraControl, configs: any);
    /**
     * Immediately attempts a pick, if scheduled.
     */
    update(): void;
    fireEvents(): void;
}
export { PickController };
//# sourceMappingURL=PickController.d.ts.map