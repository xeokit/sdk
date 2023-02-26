

import {View} from "@xeokit/viewer";
import * as keycodes from "./keycodes";

/**
 * @private
 */
class KeyboardPanRotateDollyHandler {

    #view: View;
    #documentMouseMoveHandler: () => void;
    #documentKeyDownHandler: (e: any) => void;
    #documentKeyUpHandler: (e: any) => void;
    #onTick: any;

    ///////////////////
  // >>> FIX constructor sigs
    /////////////////////
    private keycodes: number;
    constructor(components: any, controllers: any, configs: any, states: any, updates: any) {

        this.#view = components.view;

        const keyDownMap: any[] = [];
        const canvasElement = components.view.canvasElement;

        let mouseMovedSinceLastKeyboardDolly = true;

        document.addEventListener("mousemove", this.#documentMouseMoveHandler = () => {
            mouseMovedSinceLastKeyboardDolly = true;
        });

        document.addEventListener("keydown", this.#documentKeyDownHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled) || (!configs.keyboardEnabled)) {
                return;
            }
            if (!states.mouseover) {
                return;
            }
            const keyCode = e.keyCode;
            keyDownMap[keyCode] = true;
            if (keyCode === keycodes.KEY_SHIFT) {
                canvasElement.style.cursor = "move";
            }
        });

        document.addEventListener("keyup", this.#documentKeyUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled) || (!configs.keyboardEnabled)) {
                return;
            }
            if (!states.mouseover) {
                return;
            }
            const keyCode = e.keyCode;
            keyDownMap[keyCode] = false;
            if (keyCode === keycodes.KEY_SHIFT) {
                canvasElement.style.cursor = null;
            }
        });

        this.#onTick = components.view.viewer.events.on("tick", (e: { deltaTime: number; }) => {

            if (!(configs.active && configs.pointerEnabled) || (!configs.keyboardEnabled)) {
                return;
            }

            if (!states.mouseover) {
                return;
            }

            const cameraControl = controllers.cameraControl;
            const elapsedSecs = (e.deltaTime / 1000.0);

            //-------------------------------------------------------------------------------------------------
            // Keyboard rotation
            //-------------------------------------------------------------------------------------------------

            if (!configs.planView) {

                const rotateYPos = cameraControl._isKeyDownForAction(cameraControl.ROTATE_Y_POS, keyDownMap);
                const rotateYNeg = cameraControl._isKeyDownForAction(cameraControl.ROTATE_Y_NEG, keyDownMap);
                const rotateXPos = cameraControl._isKeyDownForAction(cameraControl.ROTATE_X_POS, keyDownMap);
                const rotateXNeg = cameraControl._isKeyDownForAction(cameraControl.ROTATE_X_NEG, keyDownMap);

                const orbitDelta = elapsedSecs * configs.keyboardRotationRate;

                if (rotateYPos || rotateYNeg || rotateXPos || rotateXNeg) {

                    if ((!configs.firstPerson) && configs.followPointer) {
                        controllers.pivotController.startPivot();
                    }

                    if (rotateYPos) {
                        updates.rotateDeltaY += orbitDelta;

                    } else if (rotateYNeg) {
                        updates.rotateDeltaY -= orbitDelta;
                    }

                    if (rotateXPos) {
                        updates.rotateDeltaX += orbitDelta;

                    } else if (rotateXNeg) {
                        updates.rotateDeltaX -= orbitDelta;
                    }

                    if ((!configs.firstPerson) && configs.followPointer) {
                        controllers.pivotController.startPivot();
                    }
                }
            }

            //-------------------------------------------------------------------------------------------------
            // Keyboard panning
            //-------------------------------------------------------------------------------------------------

            if (!keyDownMap[keycodes.KEY_CTRL] && !keyDownMap[keycodes.KEY_ALT]) {

                const dollyBackwards = cameraControl._isKeyDownForAction(cameraControl.DOLLY_BACKWARDS, keyDownMap);
                const dollyForwards = cameraControl._isKeyDownForAction(cameraControl.DOLLY_FORWARDS, keyDownMap);

                if (dollyBackwards || dollyForwards) {

                    const dollyDelta = elapsedSecs * configs.keyboardDollyRate;

                    if ((!configs.firstPerson) && configs.followPointer) {
                        controllers.pivotController.startPivot();
                    }
                    if (dollyForwards) {
                        updates.dollyDelta -= dollyDelta;
                    } else if (dollyBackwards) {
                        updates.dollyDelta += dollyDelta;
                    }

                    if (mouseMovedSinceLastKeyboardDolly) {
                        states.followPointerDirty = true;
                        mouseMovedSinceLastKeyboardDolly = false;
                    }
                }
            }

            const panForwards = cameraControl._isKeyDownForAction(cameraControl.PAN_FORWARDS, keyDownMap);
            const panBackwards = cameraControl._isKeyDownForAction(cameraControl.PAN_BACKWARDS, keyDownMap);
            const panLeft = cameraControl._isKeyDownForAction(cameraControl.PAN_LEFT, keyDownMap);
            const panRight = cameraControl._isKeyDownForAction(cameraControl.PAN_RIGHT, keyDownMap);
            const panUp = cameraControl._isKeyDownForAction(cameraControl.PAN_UP, keyDownMap);
            const panDown = cameraControl._isKeyDownForAction(cameraControl.PAN_DOWN, keyDownMap);

            const panDelta = (keyDownMap[keycodes.KEY_ALT] ? 0.3 : 1.0) * elapsedSecs * configs.keyboardPanRate; // ALT for slower pan rate

            if (panForwards || panBackwards || panLeft || panRight || panUp || panDown) {

                if ((!configs.firstPerson) && configs.followPointer) {
                    controllers.pivotController.startPivot();
                }

                if (panDown) {
                    updates.panDeltaY += panDelta;

                } else if (panUp) {
                    updates.panDeltaY += -panDelta;
                }

                if (panRight) {
                    updates.panDeltaX += -panDelta;

                } else if (panLeft) {
                    updates.panDeltaX += panDelta;
                }

                if (panBackwards) {
                    updates.panDeltaZ += panDelta;

                } else if (panForwards) {
                    updates.panDeltaZ += -panDelta;
                }
            }
        });
    }

    reset() {
    }

    destroy() {

        this.#view.viewer.onTick.unsubscribe(this.#onTick);

        document.removeEventListener("mousemove", this.#documentMouseMoveHandler);
        document.removeEventListener("keydown", this.#documentKeyDownHandler);
        document.removeEventListener("keyup", this.#documentKeyUpHandler);
    }
}

export {KeyboardPanRotateDollyHandler};