import {addVec3, mulVec3Scalar, normalizeVec3, createVec3} from "@xeokit/matrix";
import {getAABB3Center, getAABB3Diag} from "@xeokit/boundaries";
import {DEGTORAD} from "@xeokit/math";


const center = createVec3();
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempVec3d = createVec3();

const tempCameraTarget = {
    eye: new Float64Array(3),
    look: new Float64Array(3),
    up: new Float64Array(3),
    orthoScale: 1
};

/**
 * @private
 */
class KeyboardAxisViewHandler {

    #documentKeyDownHandler: (e: any) => void;

    constructor(components: any, controllers: any, configs: any, states: any, updates: any) {

        const view = components.view;
        const camera = components.camera;
        const cameraControl = controllers.cameraControl;

        document.addEventListener("keydown", this.#documentKeyDownHandler = (e) => {

            if (!(configs.active && configs.pointerEnabled) || (!configs.keyboardEnabled)) {
                return;
            }

            if (!states.mouseover) {
                return;
            }

            const axisViewRight = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_RIGHT);
            const axisViewBack = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_BACK);
            const axisViewLeft = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_LEFT);
            const axisViewFront = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_FRONT);
            const axisViewTop = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_TOP);
            const axisViewBottom = cameraControl._isKeyDownForAction(cameraControl.AXIS_VIEW_BOTTOM);

            if ((!axisViewRight) && (!axisViewBack) && (!axisViewLeft) && (!axisViewFront) && (!axisViewTop) && (!axisViewBottom)) {
                return;
            }

            const aabb = view.aabb;
            const diag = getAABB3Diag(aabb);

            getAABB3Center(aabb, center);

            const perspectiveDist = Math.abs(diag / Math.tan(controllers.cameraFlight.fitFOV * DEGTORAD));
            const orthoScale = diag * 1.1;

            tempCameraTarget.orthoScale = orthoScale;

            if (axisViewRight) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldRight, perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(camera.worldUp);

            } else if (axisViewBack) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldForward, perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(camera.worldUp);

            } else if (axisViewLeft) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldRight, -perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(camera.worldUp);

            } else if (axisViewFront) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldForward, -perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(camera.worldUp);

            } else if (axisViewTop) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldUp, perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(normalizeVec3(mulVec3Scalar(camera.worldForward, 1, tempVec3b), tempVec3c));

            } else if (axisViewBottom) {

                tempCameraTarget.eye.set(addVec3(center, mulVec3Scalar(camera.worldUp, -perspectiveDist, tempVec3a), tempVec3d));
                tempCameraTarget.look.set(center);
                tempCameraTarget.up.set(normalizeVec3(mulVec3Scalar(camera.worldForward, -1, tempVec3b)));
            }

            if ((!configs.firstPerson) && configs.followPointer) {
                controllers.pivotController.setPivotPos(center);
            }

            if (controllers.cameraFlight.duration > 0) {
                controllers.cameraFlight.flyTo(tempCameraTarget, () => {
                    if (controllers.pivotController.getPivoting() && configs.followPointer) {
                        controllers.pivotController.showPivot();
                    }
                });

            } else {
                controllers.cameraFlight.jumpTo(tempCameraTarget);
                if (controllers.pivotController.getPivoting() && configs.followPointer) {
                    controllers.pivotController.showPivot();
                }
            }
        });
    }

    reset() {
    }

    destroy() {
        document.removeEventListener("keydown", this.#documentKeyDownHandler);
    }
}

export {KeyboardAxisViewHandler};