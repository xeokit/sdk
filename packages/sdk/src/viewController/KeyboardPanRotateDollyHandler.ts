import type {View} from "../viewer";
import {SDKTask} from "../core";
import {KEY_SHIFT} from "./keycodes";

/**
 * @private
 */
export class KeyboardPanRotateDollyHandler {
  #view: View;
  #documentKeyDownHandler: (e: KeyboardEvent) => void;
  #documentKeyUpHandler: (e: KeyboardEvent) => void;
  #updateTask: SDKTask;

  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

    this.#view = view;

    const keyDownMap: boolean[] = [];
    let mouseMovedSinceLastKeyboardDolly = true;
    let lastTime = performance.now();

    view.htmlElement.addEventListener("mousemove", () => {
      mouseMovedSinceLastKeyboardDolly = true;
    });

    document.addEventListener("keydown", this.#documentKeyDownHandler = (e: KeyboardEvent) => {
      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }
      if (configs.keyboardEnabledOnlyIfMouseover && !states.mouseover) {
        return;
      }
      keyDownMap[e.keyCode] = true;
      if (e.keyCode === KEY_SHIFT) {
        view.htmlElement.style.cursor = "move";
      }
    });

    document.addEventListener("keyup", this.#documentKeyUpHandler = (e: KeyboardEvent) => {
      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }
      keyDownMap[e.keyCode] = false;
      if (e.keyCode === KEY_SHIFT) {
        view.htmlElement.style.cursor = null;
      }
      if (controllers.pivotController.getPivoting()) {
        controllers.pivotController.endPivot();
      }
    });

    this.#updateTask = new SDKTask({
      name: "KeyboardPanRotateDollyHandler._updateTask",
      stage: SDKTask.CollectInputStage,
      repeat: true,
      task: () => {

        if (!(configs.active && configs.pointerEnabled)) {
          return;
        }

        if (configs.keyboardEnabledOnlyIfMouseover && !states.mouseover) {
          return;
        }

        const now = performance.now();
        const elapsedSecs = Math.min((now - lastTime) / 1000.0, 0.1); // cap to avoid big jumps after tab switch
        lastTime = now;

        const viewController = controllers.viewController;
        const VC = viewController.constructor; // ViewController class (static constants)

        // Rotation

        if (!configs.planView) {

          const rotateYPos = viewController._isKeyDownForAction(VC.ROTATE_Y_POS, keyDownMap);
          const rotateYNeg = viewController._isKeyDownForAction(VC.ROTATE_Y_NEG, keyDownMap);
          const rotateXPos = viewController._isKeyDownForAction(VC.ROTATE_X_POS, keyDownMap);
          const rotateXNeg = viewController._isKeyDownForAction(VC.ROTATE_X_NEG, keyDownMap);

          if (rotateYPos || rotateYNeg || rotateXPos || rotateXNeg) {

            const orbitDelta = elapsedSecs * configs.keyboardRotationRate;

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
          }
        }

        // Dollying

        if (!keyDownMap[17] && !keyDownMap[18]) { // not CTRL or ALT

          const dollyBackwards = viewController._isKeyDownForAction(VC.DOLLY_BACKWARDS, keyDownMap);
          const dollyForwards = viewController._isKeyDownForAction(VC.DOLLY_FORWARDS, keyDownMap);

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

        // Panning

        const panForwards = viewController._isKeyDownForAction(VC.PAN_FORWARDS, keyDownMap);
        const panBackwards = viewController._isKeyDownForAction(VC.PAN_BACKWARDS, keyDownMap);
        const panLeft = viewController._isKeyDownForAction(VC.PAN_LEFT, keyDownMap);
        const panRight = viewController._isKeyDownForAction(VC.PAN_RIGHT, keyDownMap);
        const panUp = viewController._isKeyDownForAction(VC.PAN_UP, keyDownMap);
        const panDown = viewController._isKeyDownForAction(VC.PAN_DOWN, keyDownMap);

        if (panForwards || panBackwards || panLeft || panRight || panUp || panDown) {

          const panDelta = (keyDownMap[18] ? 0.3 : 1.0) * elapsedSecs * configs.keyboardPanRate; // ALT for slower pan

          if ((!configs.firstPerson) && configs.followPointer) {
            controllers.pivotController.startPivot();
          }

          if (panDown) {
            updates.panDeltaY += panDelta;
          } else if (panUp) {
            updates.panDeltaY -= panDelta;
          }

          if (panRight) {
            updates.panDeltaX -= panDelta;
          } else if (panLeft) {
            updates.panDeltaX += panDelta;
          }

          if (panBackwards) {
            updates.panDeltaZ += panDelta;
          } else if (panForwards) {
            updates.panDeltaZ -= panDelta;
          }
        }
      }
    });
  }

  reset() {
  }

  destroy() {
    document.removeEventListener("keydown", this.#documentKeyDownHandler);
    document.removeEventListener("keyup", this.#documentKeyUpHandler);
    this.#updateTask.destroy();
  }
}
