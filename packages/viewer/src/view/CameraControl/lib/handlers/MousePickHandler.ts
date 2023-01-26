
import type {View} from "../../../View";
import type {PickResult} from "../../../PickResult";
import {subVec3} from "@xeokit/math/matrix";
import {getAABB3Center} from "@xeokit/math/boundaries";

/**
 * @private
 */
class MousePickHandler {

    #view: View;
    #clicks: number;
    #timeout: any;
    #lastPickedobjectId: any;
    #canvasMouseMoveHandler: (e: any) => void;
    #canvasMouseDownHandler: (e: any) => void;
    #documentMouseUpHandler: (e: any) => void;
    #canvasMouseUpHandler: (e: any) => void;

    constructor(components: any, controllers: any, configs: any, states: any, updates: any) {

        this.#view = components.view;

        const pickController = controllers.pickController;
        const pivotController = controllers.pivotController;
        const cameraControl = controllers.cameraControl;

        this.#clicks = 0;
        this.#timeout = null;
        this.#lastPickedobjectId = null;

        let leftDown = false;
        let rightDown = false;

        const canvasElement = this.#view.canvasElement;

        const flyCameraTo = (pickResult?: PickResult) => {
            let pos;
            if (pickResult && pickResult.worldPos) {
                pos = pickResult.worldPos
            }
            const aabb = pickResult && pickResult.viewObject
                ? pickResult.viewObject.viewerObject.aabb
                : this.#view.viewer.aabb;
            if (pos) { // Fly to look at point, don't change eye->look dist
                const camera = this.#view.camera;
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

        canvasElement.addEventListener("mousemove", this.#canvasMouseMoveHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }

            if (leftDown || rightDown) {
                return;
            }

            const hoverSubs = cameraControl.events.hasSubs("hover");
            const hoverOutSubs = cameraControl.events.hasSubs("hoverOut");
            const hoverOffSubs = cameraControl.events.hasSubs("hoverOff");
            const hoverSurfaceSubs = cameraControl.events.hasSubs("hoverSurface");

            if (hoverSubs || hoverOutSubs || hoverOffSubs || hoverSurfaceSubs) {

                pickController.pickCursorPos = states.pointerViewPos;
                pickController.schedulePickEntity = true;
                pickController.schedulePickSurface = hoverSurfaceSubs;

                pickController.update();

                if (pickController.pickResult) {

                    const pickedobjectId = pickController.pickResult.entity.id;

                    if (this.#lastPickedobjectId !== pickedobjectId) {

                        if (this.#lastPickedobjectId !== undefined) {

                            cameraControl.events.fire("hoverOut", { // Hovered off an entity
                                entity: this.#view.objects[this.#lastPickedobjectId]
                            }, true);
                        }

                        cameraControl.events.fire("hoverEnter", pickController.pickResult, true); // Hovering over a new entity

                        this.#lastPickedobjectId = pickedobjectId;
                    }

                    cameraControl.events.fire("hover", pickController.pickResult, true);

                    if (pickController.pickResult.worldPos) { // Hovering the surface of an entity
                        cameraControl.events.fire("hoverSurface", pickController.pickResult, true);
                    }

                } else {

                    if (this.#lastPickedobjectId !== undefined) {

                        cameraControl.events.fire("hoverOut", { // Hovered off an entity
                            entity: this.#view.objects[this.#lastPickedobjectId]
                        }, true);

                        this.#lastPickedobjectId = undefined;
                    }

                    cameraControl.events.fire("hoverOff", { // Not hovering on any entity
                        canvasPos: pickController.pickCursorPos
                    }, true);
                }
            }
        });

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
            states.mouseDownCursorX = states.pointerViewPos[0];
            states.mouseDownCursorY = states.pointerViewPos[1];

            if ((!configs.firstPerson) && configs.followPointer) {

                pickController.pickCursorPos = states.pointerViewPos;
                pickController.schedulePickSurface = true;

                pickController.update();

                if (e.which === 1) {// Left button
                    const pickResult = pickController.pickResult;
                    if (pickResult && pickResult.worldPos) {
                        pivotController.setPivotPos(pickResult.worldPos);
                        pivotController.startPivot();
                    } else {
                        if (configs.smartPivot) {
                            pivotController.setViewPivotPos(states.pointerViewPos);
                        } else {
                            pivotController.setPivotPos(this.#view.camera.look);
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

            const pickedSubs = cameraControl.events.hasSubs("picked");
            const pickedNothingSubs = cameraControl.events.hasSubs("pickedNothing");
            const pickedSurfaceSubs = cameraControl.events.hasSubs("pickedSurface");
            const doublePickedSubs = cameraControl.events.hasSubs("doublePicked");
            const doublePickedSurfaceSubs = cameraControl.events.hasSubs("doublePickedSurface");
            const doublePickedNothingSubs = cameraControl.events.hasSubs("doublePickedNothing");

            if ((!configs.doublePickFlyTo) &&
                (!doublePickedSubs) &&
                (!doublePickedSurfaceSubs) &&
                (!doublePickedNothingSubs)) {

                //  Avoid the single/double click differentiation timeout

                if (pickedSubs || pickedNothingSubs || pickedSurfaceSubs) {

                    pickController.pickCursorPos = states.pointerViewPos;
                    pickController.schedulePickEntity = true;
                    pickController.schedulePickSurface = pickedSurfaceSubs;
                    pickController.update();

                    if (pickController.pickResult) {

                        cameraControl.events.fire("picked", pickController.pickResult, true);

                        if (pickController.pickedSurface) {
                            cameraControl.events.fire("pickedSurface", pickController.pickResult, true);
                        }
                    } else {
                        cameraControl.events.fire("pickedNothing", {
                            canvasPos: states.pointerViewPos
                        }, true);
                    }
                }

                this.#clicks = 0;

                return;
            }

            this.#clicks++;

            if (this.#clicks === 1) { // First click

                this.#timeout = setTimeout(() => {

                    pickController.pickCursorPos = states.pointerViewPos;
                    pickController.schedulePickEntity = configs.doublePickFlyTo;
                    pickController.schedulePickSurface = pickedSurfaceSubs;
                    pickController.update();

                    if (pickController.pickResult) {

                        cameraControl.events.fire("picked", pickController.pickResult, true);

                        if (pickController.pickedSurface) {

                            cameraControl.events.fire("pickedSurface", pickController.pickResult, true);

                            if ((!configs.firstPerson) && configs.followPointer) {
                                controllers.pivotController.setPivotPos(pickController.pickResult.worldPos);
                                if (controllers.pivotController.startPivot()) {
                                    controllers.pivotController.showPivot();
                                }
                            }
                        }
                    } else {
                        cameraControl.events.fire("pickedNothing", {
                            canvasPos: states.pointerViewPos
                        }, true);
                    }

                    this.#clicks = 0;

                }, 250);  // FIXME: Too short for track pads

            } else { // Second click

                if (this.#timeout !== null) {
                    window.clearTimeout(this.#timeout);
                    this.#timeout = null;
                }

                pickController.pickCursorPos = states.pointerViewPos;
                pickController.schedulePickEntity = configs.doublePickFlyTo || doublePickedSubs || doublePickedSurfaceSubs;
                pickController.schedulePickSurface = pickController.schedulePickEntity && doublePickedSurfaceSubs;
                pickController.update();

                if (pickController.pickResult) {

                    cameraControl.events.fire("doublePicked", pickController.pickResult, true);

                    if (pickController.pickedSurface) {
                        cameraControl.onDoublePickedSurface.dispatch( pickController.pickResult, true);
                    }

                    if (configs.doublePickFlyTo) {

                        flyCameraTo(pickController.pickResult);

                        if ((!configs.firstPerson) && configs.followPointer) {

                            const pickedEntityAABB = pickController.pickResult.entity.aabb;
                            const pickedEntityCenterPos = getAABB3Center(pickedEntityAABB);

                            controllers.pivotController.setPivotPos(pickedEntityCenterPos);

                            if (controllers.pivotController.startPivot()) {
                                controllers.pivotController.showPivot();
                            }
                        }
                    }

                } else {

                    cameraControl.events.fire("doublePickedNothing", {
                        canvasPos: states.pointerViewPos
                    }, true);

                    if (configs.doublePickFlyTo) {

                        flyCameraTo();

                        if ((!configs.firstPerson) && configs.followPointer) {

                            const viewAABB = this.#view.viewer.aabb;
                            const viewCenterPos = getAABB3Center(viewAABB);

                            controllers.pivotController.setPivotPos(viewCenterPos);

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
        this.#lastPickedobjectId = null;
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