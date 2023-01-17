import * as math from "../../../../math/index";
import type { CameraControl } from "../../CameraControl";
/**
 * @private
 */
declare class PivotController {
    #private;
    /**
     * @private
     */
    constructor(cameraControl: CameraControl, configs: any);
    updatePivotElement(): void;
    /**
     * Sets the HTML DOM element that will represent the pivot position.
     *
     * @param pivotElement
     */
    setPivotElement(pivotElement: HTMLElement): void;
    /**
     * Begins pivoting.
     */
    startPivot(): false | undefined;
    /**
     * Returns true if we are currently pivoting.
     *
     * @returns {boolean}
     */
    getPivoting(): boolean;
    /**
     * Sets a 3D World-space position to pivot about.
     *
     * @param worldPos The new World-space pivot position.
     */
    setPivotPos(worldPos: math.FloatArrayParam): void;
    /**
     * Sets the pivot position to the 3D projection of the given 2D canvas coordinates on a sphere centered
     * at the viewpoint. The radius of the sphere is configured via {@link CameraControl#smartPivot}.
     *
     * @param canvasPos
     */
    setCanvasPivotPos(canvasPos: math.FloatArrayParam): void;
    /**
     * Gets the current position we're pivoting about.
     * @returns {Number[]} The current World-space pivot position.
     */
    getPivotPos(): math.FloatArrayParam;
    /**
     * Continues to pivot.
     *
     * @param yawInc Yaw rotation increment.
     * @param pitchInc Pitch rotation increment.
     */
    continuePivot(yawInc: number, pitchInc: number): void;
    /**
     * Shows the pivot position.
     *
     * Only works if we set an  HTML DOM element to represent the pivot position.
     */
    showPivot(): void;
    /**
     * Hides the pivot position.
     *
     * Only works if we set an  HTML DOM element to represent the pivot position.
     */
    hidePivot(): void;
    /**
     * Finishes pivoting.
     */
    endPivot(): void;
    destroy(): void;
}
export { PivotController };
