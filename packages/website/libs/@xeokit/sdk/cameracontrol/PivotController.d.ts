import { View } from "../viewer";
import { FloatArrayParam } from "../math";
/** @private */
declare class PivotController {
    #private;
    /**
     * @private
     */
    constructor(view: View, configs: any);
    createPivotSphere(): void;
    destroyPivotSphere(): void;
    updatePivotElement(): void;
    updatePivotSphere(): void;
    /**
     * Sets the HTML DOM element that will represent the pivot position.
     *
     * @param pivotElement
     */
    setPivotElement(pivotElement: any): void;
    /**
     * Sets a sphere as the representation of the pivot position.
     *
     * @param {Object} [cfg] Sphere configuration.
     * @param {String} [cfg.size=1] Optional size factor of the sphere. Defaults to 1.
     * @param {String} [cfg.color=Array] Optional maretial color. Defaults to a red.
     */
    enablePivotSphere(cfg?: {
        size: number;
        color: number[];
    }): void;
    /**
     * Remove the sphere as the representation of the pivot position.
     *
     */
    disablePivotSphere(): void;
    /**
     * Begins pivoting.
     */
    startPivot(): boolean;
    /**
     * Returns true if we are currently pivoting.
     *
     * @returns {Boolean}
     */
    getPivoting(): boolean;
    /**
     * Sets a 3D World-space position to pivot about.
     *
     * @param {Number[]} worldPos The new World-space pivot position.
     */
    setPivotPos(worldPos: any): void;
    /**
     * Sets the pivot position to the 3D projection of the given 2D canvas coordinates on a sphere centered
     * at the viewpoint. The radius of the sphere is configured via {@link CameraControl#smartPivot}.
     *
     *
     * @param canvasPos
     */
    setCanvasPivotPos(canvasPos: any): void;
    /**
     * Gets the current position we're pivoting about.
     * @returns {Number[]} The current World-space pivot position.
     */
    getPivotPos(): FloatArrayParam;
    /**
     * Continues to pivot.
     *
     * @param {Number} yawInc Yaw rotation increment.
     * @param {Number} pitchInc Pitch rotation increment.
     */
    continuePivot(yawInc: any, pitchInc: any): void;
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
//# sourceMappingURL=PivotController.d.ts.map