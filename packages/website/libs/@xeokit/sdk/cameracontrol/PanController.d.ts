/**
 * @private
 */
declare class PanController {
    #private;
    constructor(view: any);
    /**
     * Dollys the Camera towards the given target 2D canvas position.
     *
     * When the target's corresponding World-space position is also provided, then this function will also test if we've
     * dollied past the target, and will return ````true```` if that's the case.
     *
     * @param [optionalTargetWorldPos] Optional world position of the target
     * @param targetCanvasPos Canvas position of the target
     * @param dollyDelta Amount to dolly
     * @return True if optionalTargetWorldPos was given, and we've dollied past that position.
     */
    dollyToCanvasPos(optionalTargetWorldPos: any, targetCanvasPos: any, dollyDelta: any): boolean;
    _unproject(canvasPos: any, worldPos: any): any;
    destroy(): void;
}
export { PanController };
//# sourceMappingURL=PanController.d.ts.map