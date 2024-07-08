
import {PickResult, View} from "@xeokit/viewer";
import {createVec3, subVec3, canvasPosToWorldRay} from "@xeokit/matrix";
import {getAABB3Center} from "@xeokit/boundaries";

/**
 * @private
 */
class MousePickHandler {

    #view: View;
    #clicks: number;
    #timeout: any;
    #lastPickedEntityId: any;
    #canvasMouseDownHandler: (e) => void;
    #canvasMouseMoveHandler: (e) => void;
    #canvasMouseUpHandler: (e) => void;
    #documentMouseUpHandler: (e) => void;

    constructor(view: View, controllers:any, configs:any, states:any, updates:any) {

        this.#view = view;

        const pickController = controllers.pickController;
        const pivotController = controllers.pivotController;
        const cameraControl = controllers.cameraControl;

        this.#clicks = 0;
        this.#timeout = null;
        this.#lastPickedEntityId = null;

        let leftDown = false;
        let rightDown = false;

        const canvasElement = this.#view.canvasElement;

        const flyCameraTo = (pickResult?:PickResult) => {
            let pos;
            if (pickResult && pickResult.worldPos) {
                pos = pickResult.worldPos
            }
            const aabb = pickResult && pickResult.viewObject ? pickResult.viewObject.aabb : view.aabb;
            if (pos) { // Fly to look at point, don't change eye->look dist
                const camera = view.camera;
                const diff = subVec3(camera.eye, camera.look, []);
                controllers.cameraFlight.flyTo({
                    // look: pos,
                    // eye: xeokit.addVec3(pos, diff, []),
                    // up: camera.up,
                    aabb: aabb
                });
                // TODO: Option to back off to fit AABB in view
            } else {// Fly to fit target boundary in view
                controllers.cameraFlight.flyTo({
                    aabb: aabb
                });
            }
        };

        const tickifiedMouseMoveFn = view.viewer.tickify (
            this.#canvasMouseMoveHandler = (e) => {
                if (!(configs.active && configs.pointerEnabled)) {
                    return;
                }

                if (leftDown || rightDown) {
                    return;
                }

                if (cameraControl.onRayMove.count > 0)
                {
                    const origin = createVec3();
                    const direction = createVec3();
                    canvasPosToWorldRay(view.canvasElement, view.camera.viewMatrix, view.camera.projMatrix, view.camera.projection, states.pointerCanvasPos, origin, direction);
                    cameraControl.fire("rayMove", { canvasPos: states.pointerCanvasPos, ray: { origin: origin, direction: direction, canvasPos: states.pointerCanvasPos } }, true);
                }

                const hoverSubs = cameraControl.onHover.count > 0;
                const hoverEnterSubs = cameraControl.onHoverEnter.count > 0;
                const hoverOutSubs = cameraControl.onHoverOut.count > 0;
                const hoverOffSubs = cameraControl.onHoverOff.count > 0;
                const hoverSurfaceSubs = cameraControl.onHoverSurface.count > 0;
                const hoverSnapOrSurfaceSubs = cameraControl.onHoverSnapOrSurface.count > 0;

                if (hoverSubs || hoverEnterSubs || hoverOutSubs || hoverOffSubs || hoverSurfaceSubs || hoverSnapOrSurfaceSubs) {

                    pickController.pickCursorPos = states.pointerCanvasPos;
                    pickController.schedulePickEntity = true;
                    pickController.schedulePickSurface = hoverSurfaceSubs;
                    pickController.scheduleSnapOrPick = hoverSnapOrSurfaceSubs

                    pickController.update();

                    if (pickController.pickResult) {

                        if (pickController.pickResult.viewObject) {
                            const pickedEntityId = pickController.pickResult.viewObject.id;

                            if (this.#lastPickedEntityId !== pickedEntityId) {

                                if (this.#lastPickedEntityId !== undefined) {

                                    cameraControl.fire("hoverOut", { // Hovered off an entity
                                        viewObject: view.objects[this.#lastPickedEntityId]
                                    }, true);
                                }

                                cameraControl.fire("hoverEnter", pickController.pickResult, true); // Hovering over a new entity

                                this.#lastPickedEntityId = pickedEntityId;
                            }
                        }

                        cameraControl.fire("hover", pickController.pickResult, true);

                        if (pickController.pickResult.worldPos || pickController.pickResult.snappedWorldPos) { // Hovering the surface of an entity
                            cameraControl.fire("hoverSurface", pickController.pickResult, true);
                        }

                    } else {

                        if (this.#lastPickedEntityId !== undefined) {

                            cameraControl.fire("hoverOut", { // Hovered off an entity
                                viewObject: view.objects[this.#lastPickedEntityId]
                            }, true);

                            this.#lastPickedEntityId = undefined;
                        }

                        cameraControl.fire("hoverOff", { // Not hovering on any entity
                            canvasPos: pickController.pickCursorPos
                        }, true);
                    }
                }
            }
        );

        canvasElement.addEventListener("mousemove", tickifiedMouseMoveFn);

        canvasElement.addEventListener('mousedown', this.#canvasMouseDownHandler = (e) => {

            if (e.which === 1) {
                leftDown = true;
            }

            if (e.which === 3) {
                rightDown = true;
            }

            const leftButtonDown = (e.which === 1);

            if (!leftButtonDown) {
                return;
            }

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            // Left mouse button down to start pivoting

            states.mouseDownClientX = e.clientX;
            states.mouseDownClientY = e.clientY;
            states.mouseDownCursorX = states.pointerCanvasPos[0];
            states.mouseDownCursorY = states.pointerCanvasPos[1];

            if ((!configs.firstPerson) && configs.followPointer) {

                pickController.pickCursorPos = states.pointerCanvasPos;
                pickController.schedulePickSurface = true;

                pickController.update();

                if (e.which === 1) {// Left button
                    const pickResult = pickController.pickResult;
                    if (pickResult && pickResult.worldPos) {
                        pivotController.setPivotPos(pickResult.worldPos);
                        pivotController.startPivot();
                    } else {
                        if (configs.smartPivot) {
                            pivotController.setCanvasPivotPos(states.pointerCanvasPos);
                        } else {
                            pivotController.setPivotPos(view.camera.look);
                        }
                        pivotController.startPivot();
                    }
                }
            }
        });

        document.addEventListener('mouseup', this.#documentMouseUpHandler = (e) => {

            if (e.which === 1) {
                leftDown = false;
            }

            if (e.which === 3) {
                rightDown = false;
            }

            if (pivotController.getPivoting()) {
                pivotController.endPivot();
            }
        });

        canvasElement.addEventListener('mouseup', this.#canvasMouseUpHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            const leftButtonUp = (e.which === 1);

            if (!leftButtonUp) {
                return;
            }

            // Left mouse button up to possibly pick or double-pick

            pivotController.hidePivot();

            if (Math.abs(e.clientX - states.mouseDownClientX) > 3 || Math.abs(e.clientY - states.mouseDownClientY) > 3) {
                return;
            }

            const pickedSubs = cameraControl.onPicked.count > 0;
            const pickedNothingSubs = cameraControl.onPickedNothing.count > 0;
            const pickedSurfaceSubs = cameraControl.onPickedSurface.count > 0;
            const doublePickedSubs = cameraControl.onDoublePicked.count > 0;
            const doublePickedSurfaceSubs = cameraControl.onDoublePickedSurface.count > 0;
            const doublePickedNothingSubs = cameraControl.onDoublePickedNothing.count > 0;

            if ((!configs.doublePickFlyTo) &&
                (!doublePickedSubs) &&
                (!doublePickedSurfaceSubs) &&
                (!doublePickedNothingSubs)) {

                //  Avoid the single/double click differentiation timeout

                if (pickedSubs || pickedNothingSubs || pickedSurfaceSubs) {

                    pickController.pickCursorPos = states.pointerCanvasPos;
                    pickController.schedulePickEntity = true;
                    pickController.schedulePickSurface = pickedSurfaceSubs;
                    pickController.update();

                    if (pickController.pickResult) {

                        cameraControl.fire("picked", pickController.pickResult, true);

                        if (pickController.pickedSurface) {
                            cameraControl.fire("pickedSurface", pickController.pickResult, true);
                        }
                    } else {
                        cameraControl.fire("pickedNothing", {
                            canvasPos: states.pointerCanvasPos
                        }, true);
                    }
                }

                this.#clicks = 0;

                return;
            }

            this.#clicks++;

            if (this.#clicks === 1) { // First click

                pickController.pickCursorPos = states.pointerCanvasPos;
                pickController.schedulePickEntity = configs.doublePickFlyTo;
                pickController.schedulePickSurface = pickedSurfaceSubs;
                pickController.update();

                const firstClickPickResult = pickController.pickResult;
                const firstClickPickSurface = pickController.pickedSurface;

                this.#timeout = setTimeout(() => {

                    if (firstClickPickResult && firstClickPickResult.worldPos) {

                        cameraControl.fire("picked", firstClickPickResult, true);

                        if (firstClickPickSurface) {

                            cameraControl.fire("pickedSurface", firstClickPickResult, true);

                            if ((!configs.firstPerson) && configs.followPointer) {
                                controllers.pivotController.setPivotPos(firstClickPickResult.worldPos);
                                if (controllers.pivotController.startPivot()) {
                                    controllers.pivotController.showPivot();
                                }
                            }
                        }
                    } else {
                        cameraControl.fire("pickedNothing", {
                            canvasPos: states.pointerCanvasPos
                        }, true);
                    }

                    this.#clicks = 0;

                }, configs.doubleClickTimeFrame);

            } else { // Second click

                if (this.#timeout !== null) {
                    window.clearTimeout(this.#timeout);
                    this.#timeout = null;
                }

                pickController.pickCursorPos = states.pointerCanvasPos;
                pickController.schedulePickEntity = configs.doublePickFlyTo || doublePickedSubs || doublePickedSurfaceSubs;
                pickController.schedulePickSurface = pickController.schedulePickEntity && doublePickedSurfaceSubs;
                pickController.update();

                if (pickController.pickResult) {

                    cameraControl.fire("doublePicked", pickController.pickResult, true);

                    if (pickController.pickedSurface) {
                        cameraControl.fire("doublePickedSurface", pickController.pickResult, true);
                    }

                    if (configs.doublePickFlyTo) {

                        flyCameraTo(pickController.pickResult);

                        if ((!configs.firstPerson) && configs.followPointer) {

                            const pickedEntityAABB = pickController.pickResult.viewObject.aabb;
                            const pickedEntityCenterPos = getAABB3Center(pickedEntityAABB);

                            controllers.pivotController.setPivotPos(pickedEntityCenterPos);

                            if (controllers.pivotController.startPivot()) {
                                controllers.pivotController.showPivot();
                            }
                        }
                    }

                } else {

                    cameraControl.fire("doublePickedNothing", {
                        canvasPos: states.pointerCanvasPos
                    }, true);

                    if (configs.doublePickFlyTo) {

                        flyCameraTo();

                        if ((!configs.firstPerson) && configs.followPointer) {

                            const sceneAABB = view.aabb;
                            const sceneCenterPos = getAABB3Center(sceneAABB);

                            controllers.pivotController.setPivotPos(sceneCenterPos);

                            if (controllers.pivotController.startPivot()) {
                                controllers.pivotController.showPivot();
                            }
                        }
                    }
                }

                this.#clicks = 0;
            }
        }, false);
    }

    reset() {
        this.#clicks = 0;
        this.#lastPickedEntityId = null;
        if (this.#timeout) {
            window.clearTimeout(this.#timeout);
            this.#timeout = null;
        }
    }

    destroy() {
        const canvasElement = this.#view.canvasElement;
        canvasElement.removeEventListener("mousemove", this.#canvasMouseMoveHandler);
        canvasElement.removeEventListener("mousedown", this.#canvasMouseDownHandler);
        document.removeEventListener("mouseup", this.#documentMouseUpHandler);
        canvasElement.removeEventListener("mouseup", this.#canvasMouseUpHandler);
        if (this.#timeout) {
            window.clearTimeout(this.#timeout);
            this.#timeout = null;
        }
    }
}



export {MousePickHandler};
