
import {View} from "@xeokit/viewer";
import {createVec3} from "@xeokit/matrix";

const center = createVec3();
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempVec3d = createVec3();

const tempCameraTarget = {
    eye: createVec3(),
    look: createVec3(),
    up: createVec3()
};

/**
 * @private
 */
export class KeyboardAxisViewHandler {
    #view: View;

    constructor(view: View, controllers:any, configs:any, states:any, updates: any) {

        this.#view = view;
        // const cameraControl = controllers.cameraControl;
        // const camera = view.camera;
        //
        // this._onSceneKeyDown = view.input.on("keydown", () => {
        //
        //     if (!(configs.active && configs.pointerEnabled) || (!view.input.keyboardEnabled)) {
        //         return;
        //     }
        //
        //     if (configs.keyboardEnabledOnlyIfMouseover && !states.mouseover) {
        //         return;
        //     }
        //
        //     const axisViewRight = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_RIGHT);
        //     const axisViewBack = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_BACK);
        //     const axisViewLeft = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_LEFT);
        //     const axisViewFront = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_FRONT);
        //     const axisViewTop = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_TOP);
        //     const axisViewBottom = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_BOTTOM);
        //
        //     if ((!axisViewRight) && (!axisViewBack) && (!axisViewLeft) && (!axisViewFront) && (!axisViewTop) && (!axisViewBottom)) {
        //         return;
        //     }
        //
        //     const aabb = view.aabb;
        //     const diag = math.getAABB3Diag(aabb);
        //
        //     math.getAABB3Center(aabb, center);
        //
        //     const perspectiveDist = Math.abs(diag / Math.tan(controllers.cameraFlight.fitFOV * math.DEGTORAD));
        //     const orthoScale = diag * 1.1;
        //
        //     tempCameraTarget.orthoScale = orthoScale;
        //
        //     if (axisViewRight) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldRight, perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(camera.worldUp);
        //
        //     } else if (axisViewBack) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldForward, perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(camera.worldUp);
        //
        //     } else if (axisViewLeft) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldRight, -perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(camera.worldUp);
        //
        //     } else if (axisViewFront) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldForward, -perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(camera.worldUp);
        //
        //     } else if (axisViewTop) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldUp, perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(math.normalizeVec3(math.mulVec3Scalar(camera.worldForward, 1, tempVec3b), tempVec3c));
        //
        //     } else if (axisViewBottom) {
        //
        //         tempCameraTarget.eye.set(math.addVec3(center, math.mulVec3Scalar(camera.worldUp, -perspectiveDist, tempVec3a), tempVec3d));
        //         tempCameraTarget.look.set(center);
        //         tempCameraTarget.up.set(math.normalizeVec3(math.mulVec3Scalar(camera.worldForward, -1, tempVec3b)));
        //     }
        //
        //     if ((!configs.firstPerson) && configs.followPointer) {
        //         controllers.pivotController.setPivotPos(center);
        //     }
        //
        //     if (controllers.cameraFlight.duration > 0) {
        //         controllers.cameraFlight.flyTo(tempCameraTarget, () => {
        //             if (controllers.pivotController.getPivoting() && configs.followPointer) {
        //                 controllers.pivotController.showPivot();
        //             }
        //         });
        //
        //     } else {
        //         controllers.cameraFlight.jumpTo(tempCameraTarget);
        //         if (controllers.pivotController.getPivoting() && configs.followPointer) {
        //             controllers.pivotController.showPivot();
        //         }
        //     }
        // });
    }

    reset() {
    }

    destroy() {
    //    this.#view.input.off(this._onSceneKeyDown);
    }
}


