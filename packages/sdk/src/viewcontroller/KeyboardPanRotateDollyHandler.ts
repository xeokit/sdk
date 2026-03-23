import type {View} from "../viewer";

/**
 * @private
 */
export class KeyboardPanRotateDollyHandler {
  #view: View;

  constructor(view: View, controllers, configs, states, updates) {

    this.#view = view;
    //   const input = view.input;

    const keyDownMap = [];

    // const canvas = view.canvas.canvas;
    //
    // let mouseMovedSinceLastKeyboardDolly = true;
    //
    // this._onSceneMouseMove = input.on("mousemove", () => {
    //     mouseMovedSinceLastKeyboardDolly = true;
    // });
    //
    // this._onSceneKeyDown = input.on("keydown", (keyCode) => {
    //     if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
    //         return;
    //     }
    //     if (configs.keyboardEnabledOnlyIfMouseover && !states.mouseover) {
    //         return;
    //     }
    //     keyDownMap[keyCode] = true;
    //
    //     if (keyCode === input.KEY_SHIFT) {
    //         canvas.style.cursor = "move";
    //     }
    // });
    //
    // this._onSceneKeyUp = input.on("keyup", (keyCode) => {
    //     if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
    //         return;
    //     }
    //     keyDownMap[keyCode] = false;
    //
    //     if (keyCode === input.KEY_SHIFT) {
    //         canvas.style.cursor = null;
    //     }
    //
    //     if (controllers.pivotController.getPivoting()) {
    //         controllers.pivotController.endPivot()
    //     }
    // });
    //
    // this._onTick = view.on("tick", (e) => {
    //
    //     if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
    //         return;
    //     }
    //
    //     if (configs.keyboardEnabledOnlyIfMouseover &&  !states.mouseover) {
    //         return;
    //     }
    //
    //     const viewController = controllers.viewController;
    //     const elapsedSecs = (e.deltaTime / 1000.0);
    //
    //     //-------------------------------------------------------------------------------------------------
    //     // Keyboard rotation
    //     //-------------------------------------------------------------------------------------------------
    //
    //     if (!configs.planView) {
    //
    //         const rotateYPos = viewController._isKeyDownForAction(viewController.ROTATE_Y_POS, keyDownMap);
    //         const rotateYNeg = viewController._isKeyDownForAction(viewController.ROTATE_Y_NEG, keyDownMap);
    //         const rotateXPos = viewController._isKeyDownForAction(viewController.ROTATE_X_POS, keyDownMap);
    //         const rotateXNeg = viewController._isKeyDownForAction(viewController.ROTATE_X_NEG, keyDownMap);
    //
    //         const orbitDelta = elapsedSecs * configs.keyboardRotationRate;
    //
    //         if (rotateYPos || rotateYNeg || rotateXPos || rotateXNeg) {
    //
    //             if ((!configs.firstPerson) && configs.followPointer) {
    //                 controllers.pivotController.startPivot();
    //             }
    //
    //             if (rotateYPos) {
    //                 updates.rotateDeltaY += orbitDelta;
    //
    //             } else if (rotateYNeg) {
    //                 updates.rotateDeltaY -= orbitDelta;
    //             }
    //
    //             if (rotateXPos) {
    //                 updates.rotateDeltaX += orbitDelta;
    //
    //             } else if (rotateXNeg) {
    //                 updates.rotateDeltaX -= orbitDelta;
    //             }
    //
    //             if ((!configs.firstPerson) && configs.followPointer) {
    //                 controllers.pivotController.startPivot();
    //             }
    //         }
    //     }
    //
    //     //-------------------------------------------------------------------------------------------------
    //     // Keyboard panning
    //     //-------------------------------------------------------------------------------------------------
    //
    //     if (!keyDownMap[input.KEY_CTRL] && !keyDownMap[input.KEY_ALT]) {
    //
    //         const dollyBackwards = viewController._isKeyDownForAction(viewController.DOLLY_BACKWARDS, keyDownMap);
    //         const dollyForwards = viewController._isKeyDownForAction(viewController.DOLLY_FORWARDS, keyDownMap);
    //
    //         if (dollyBackwards || dollyForwards) {
    //
    //             const dollyDelta = elapsedSecs * configs.keyboardDollyRate;
    //
    //             if ((!configs.firstPerson) && configs.followPointer) {
    //                 controllers.pivotController.startPivot();
    //             }
    //             if (dollyForwards) {
    //                 updates.dollyDelta -= dollyDelta;
    //             } else if (dollyBackwards) {
    //                 updates.dollyDelta += dollyDelta;
    //             }
    //
    //             if (mouseMovedSinceLastKeyboardDolly) {
    //                 states.followPointerDirty = true;
    //                 mouseMovedSinceLastKeyboardDolly = false;
    //             }
    //         }
    //     }
    //
    //     const panForwards = viewController._isKeyDownForAction(viewController.PAN_FORWARDS, keyDownMap);
    //     const panBackwards = viewController._isKeyDownForAction(viewController.PAN_BACKWARDS, keyDownMap);
    //     const panLeft = viewController._isKeyDownForAction(viewController.PAN_LEFT, keyDownMap);
    //     const panRight = viewController._isKeyDownForAction(viewController.PAN_RIGHT, keyDownMap);
    //     const panUp = viewController._isKeyDownForAction(viewController.PAN_UP, keyDownMap);
    //     const panDown = viewController._isKeyDownForAction(viewController.PAN_DOWN, keyDownMap);
    //
    //     const panDelta = (keyDownMap[input.KEY_ALT] ? 0.3 : 1.0) * elapsedSecs * configs.keyboardPanRate; // ALT for slower pan rate
    //
    //     if (panForwards || panBackwards || panLeft || panRight || panUp || panDown) {
    //
    //         if ((!configs.firstPerson) && configs.followPointer) {
    //             controllers.pivotController.startPivot();
    //         }
    //
    //         if (panDown) {
    //             updates.panDeltaY += panDelta;
    //
    //         } else if (panUp) {
    //             updates.panDeltaY += -panDelta;
    //         }
    //
    //         if (panRight) {
    //             updates.panDeltaX += -panDelta;
    //
    //         } else if (panLeft) {
    //             updates.panDeltaX += panDelta;
    //         }
    //
    //         if (panBackwards) {
    //             updates.panDeltaZ += panDelta;
    //
    //         } else if (panForwards) {
    //             updates.panDeltaZ += -panDelta;
    //         }
    //     }
    // });
  }

  reset() {
  }

  destroy() {

    // this.#view.off(this._onTick);
    //
    // this.#view.input.off(this._onSceneMouseMove);
    // this.#view.input.off(this._onSceneKeyDown);
    // this.#view.input.off(this._onSceneKeyUp);
  }
}

