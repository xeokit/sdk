import {PickResult, View} from "@xeokit/viewer";
import {CameraControl} from "./CameraControl";
import {createVec2} from "@xeokit/matrix";

const DEFAULT_SNAP_PICK_RADIUS = 45;
const DEFAULT_SNAP_MODE = "vertex";

/**
 *
 * @private
 */
class PickController {
    #view: View;
    #cameraControl: CameraControl;
    #configs: any;
    private schedulePickEntity: boolean;
    private schedulePickSurface: boolean;
    private scheduleSnapOrPick: boolean;
    private pickCursorPos: any;
    private picked: boolean;
    private pickedSurface: boolean;
    private pickResult: PickResult;
    #lastPickedEntityId: any;
    #lastHash: any;
    #needFireEvents: number;
    private snappedOrPicked: boolean;
    private hoveredSnappedOrSurfaceOff: boolean;
    private snapPickResult: PickResult;

    constructor(cameraControl: CameraControl, configs: any) {

        this.#view = cameraControl.view;

        this.#cameraControl = cameraControl;

        this.#view.htmlElement.oncontextmenu = function (e) {
            e.preventDefault();
        };

        this.#configs = configs;

        /**
         * Set true to schedule picking of an Entity.
         * @type {boolean}
         */
        this.schedulePickEntity = false;

        /**
         * Set true to schedule picking of a position on teh surface of an Entity.
         * @type {boolean}
         */
        this.schedulePickSurface = false;

        /**
         * Set true to schedule snap-picking with surface picking as a fallback - used for measurement.
         * @type {boolean}
         */
        this.scheduleSnapOrPick = false;

        /**
         * The canvas position at which to do the next scheduled pick.
         * @type {Number[]}
         */
        this.pickCursorPos = createVec2();

        /**
         * Will be true after picking to indicate that something was picked.
         * @type {boolean}
         */
        this.picked = false;

        /**
         * Will be true after picking to indicate that a position on the surface of an Entity was picked.
         * @type {boolean}
         */
        this.pickedSurface = false;

        /**
         * Will hold the PickResult after after picking.
         * @type {PickResult}
         */
        this.pickResult = null;

        this.#lastPickedEntityId = null;

        this.#lastHash = null;

        this.#needFireEvents = 0;
    }

    /**
     * Immediately attempts a pick, if scheduled.
     */
    update() {

        if (!this.#configs.pointerEnabled) {
            return;
        }

        if (!this.schedulePickEntity && !this.schedulePickSurface) {
            return;
        }

        const hash = `${~~this.pickCursorPos[0]}-${~~this.pickCursorPos[1]}-${this.scheduleSnapOrPick}-${this.schedulePickSurface}-${this.schedulePickEntity}`;
        if (this.#lastHash === hash) {
            return;
        }

        this.picked = false;
        this.pickedSurface = false;
        this.snappedOrPicked = false;
        this.hoveredSnappedOrSurfaceOff = false;

        const hasHoverSurfaceSubs = this.#cameraControl.onHoverSurface.count > 0;

        if (this.scheduleSnapOrPick) {
            const snapPickResult = this.#view.pick({
                canvasPos: this.pickCursorPos,
                snapRadius: this.#configs.snapRadius,
                snapToVertex: this.#configs.snapToVertex,
                snapToEdge: this.#configs.snapToEdge,
            });
            if (snapPickResult && (snapPickResult.snappedToEdge || snapPickResult.snappedToVertex)) {
                this.snapPickResult = snapPickResult;
                this.snappedOrPicked = true;
                this.#needFireEvents++;
            } else {
                this.schedulePickSurface = true; // Fallback
                this.snapPickResult = null;
            }
        }

        if (this.schedulePickSurface) {
            if (this.pickResult && this.pickResult.worldPos) {
                const pickResultCanvasPos = this.pickResult.canvasPos;
                if (pickResultCanvasPos[0] === this.pickCursorPos[0] && pickResultCanvasPos[1] === this.pickCursorPos[1]) {
                    this.picked = true;
                    this.pickedSurface = true;
                    this.#needFireEvents += hasHoverSurfaceSubs ? 1 : 0;
                    this.schedulePickEntity = false;
                    this.schedulePickSurface = false;
                    if (this.scheduleSnapOrPick) {
                        this.snappedOrPicked = true;
                    } else {
                        this.hoveredSnappedOrSurfaceOff = true;
                    }
                    this.scheduleSnapOrPick = false;
                    return;
                }
            }
        }

        if (this.schedulePickEntity) {
            if (this.pickResult && (this.pickResult.canvasPos || this.pickResult.snappedCanvasPos)) {
                const pickResultCanvasPos = this.pickResult.canvasPos || this.pickResult.snappedCanvasPos;
                if (pickResultCanvasPos[0] === this.pickCursorPos[0] && pickResultCanvasPos[1] === this.pickCursorPos[1]) {
                    this.picked = true;
                    this.pickedSurface = false;
                    this.schedulePickEntity = false;
                    this.schedulePickSurface = false;
                    return;
                }
            }
        }

        if (this.schedulePickSurface || (this.scheduleSnapOrPick && !this.snapPickResult)) {
            this.pickResult = this.#view.pick({
                pickSurface: true,
                pickSurfaceNormal: false,
                canvasPos: this.pickCursorPos
            });
            if (this.pickResult) {
                this.picked = true;
                if (this.scheduleSnapOrPick) {
                    this.snappedOrPicked = true;
                } else {
                    this.pickedSurface = true;
                }
                this.#needFireEvents++;
            } else if (this.scheduleSnapOrPick) {
                this.hoveredSnappedOrSurfaceOff = true;
                this.#needFireEvents++;
            }

        } else { // schedulePickEntity == true

            this.pickResult = this.#view.pick({
                canvasPos: this.pickCursorPos
            });

            if (this.pickResult) {
                this.picked = true;
                this.pickedSurface = false;
                this.#needFireEvents++;
            }
        }

        this.scheduleSnapOrPick = false;
        this.schedulePickEntity = false;
        this.schedulePickSurface = false;
    }

    fireEvents() {

        if (this.#needFireEvents === 0) {
            return;
        }

        if (this.hoveredSnappedOrSurfaceOff) {
            this.#cameraControl.onHoverSnapOrSurfaceOff.dispatch(this.#cameraControl, {
                canvasPos: this.pickCursorPos,
                pointerPos: this.pickCursorPos
            });
        }

        if (this.snappedOrPicked) {
            if (this.snapPickResult) {
                const pickResult = new PickResult();
                pickResult.viewObject = this.snapPickResult.viewObject;
                pickResult.snappedToVertex = this.snapPickResult.snappedToVertex;
                pickResult.snappedToEdge = this.snapPickResult.snappedToEdge;
                pickResult.worldPos = this.snapPickResult.worldPos;
                pickResult.canvasPos = this.pickCursorPos
                pickResult.snappedCanvasPos = this.snapPickResult.snappedCanvasPos;
                this.#cameraControl.onHoverSnapOrSurface.dispatch(this.#cameraControl, pickResult);
                this.snapPickResult = null;
            } else {
                this.#cameraControl.onHoverSnapOrSurface.dispatch(this.#cameraControl, this.pickResult);
            }
        } else {

        }

        if (this.picked && this.pickResult && (this.pickResult.viewObject || this.pickResult.worldPos)) {

            if (this.pickResult.viewObject) {

                const pickedEntityId = this.pickResult.viewObject.id;

                if (this.#lastPickedEntityId !== pickedEntityId) {

                    if (this.#lastPickedEntityId !== undefined) {
                        this.#cameraControl.onHoverOut.dispatch(this.#cameraControl, {
                            viewObject: this.#view.objects[this.#lastPickedEntityId]
                        });
                    }

                    this.#cameraControl.onHoverEnter.dispatch(this.#cameraControl, this.pickResult);
                    this.#lastPickedEntityId = pickedEntityId;
                }
            }

            this.#cameraControl.onHover.dispatch(this.#cameraControl, this.pickResult);

            if (this.pickResult.worldPos) {
                this.pickedSurface = true;
                this.#cameraControl.onHoverSurface.dispatch(this.#cameraControl, this.pickResult);
            }

        } else {

            if (this.#lastPickedEntityId !== undefined) {
                this.#cameraControl.onHoverOut.dispatch(this.#cameraControl, {
                    viewObject: this.#view.objects[this.#lastPickedEntityId]
                });
                this.#lastPickedEntityId = undefined;
            }

            this.#cameraControl.onHoverOff.dispatch(this.#cameraControl, {
                canvasPos: this.pickCursorPos
            });
        }

        this.pickResult = null;

        this.#needFireEvents = 0;
    }
}

export {PickController};
