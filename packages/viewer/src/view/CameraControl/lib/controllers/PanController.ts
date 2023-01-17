

import type {View} from "../../../View";
import type {CameraControl} from "../../CameraControl";
import {addVec3, dotVec4, lenVec3, mulVec3Scalar, normalizeVec3, subVec3, createVec3, createVec4} from "@xeokit/math/matrix";
import {OrthoProjectionType, PerspectiveProjectionType} from "@xeokit/core/constants";
import {FloatArrayParam} from "@xeokit/math/math";

const screenPos = createVec4();
const viewPos = createVec4();

const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempVec4c = createVec4();

/**
 * @private
 */
class PanController {

    private view: View;

    constructor(cameraControl: CameraControl) {
        this.view = cameraControl.view;
    }

    /**
     * Dollys the Camera towards the given target 2D canvas position.
     *
     * When the target's corresponding World-space position is also provided, then this function will also test if we've
     * dollied past the target, and will return ````true```` if that's the case.
     *
     * @param [optionalTargetWorldPos] Optional world position of the target
     * @param targetCanvasPos Canvas position of the target
     * @param dollyDelta Amount to dolly
     * @return True if optionalTargetWorldPos was given, and we've dollied past that position.
     */
    dollyToCanvasPos(optionalTargetWorldPos: any, targetCanvasPos: any, dollyDelta: number) {

        let dolliedThroughSurface = false;

        const camera = this.view.camera;

        if (optionalTargetWorldPos) {
            const eyeToWorldPosVec = subVec3(optionalTargetWorldPos, camera.eye, tempVec3a);
            const eyeWorldPosDist = lenVec3(eyeToWorldPosVec);
            dolliedThroughSurface = (eyeWorldPosDist < dollyDelta);
        }

        if (camera.projection === PerspectiveProjectionType) {

            camera.ortho.scale = camera.ortho.scale - dollyDelta;

            const unprojectedWorldPos = this.#unproject(targetCanvasPos, tempVec4a);
            const offset = subVec3(unprojectedWorldPos, camera.eye, tempVec4c);
            const moveVec = mulVec3Scalar(normalizeVec3(offset), -dollyDelta, []);

            camera.eye = [camera.eye[0] - moveVec[0], camera.eye[1] - moveVec[1], camera.eye[2] - moveVec[2]];
            camera.look = [camera.look[0] - moveVec[0], camera.look[1] - moveVec[1], camera.look[2] - moveVec[2]];

            if (optionalTargetWorldPos) {

                // Subtle UX tweak - if we have a target World position, then set camera eye->look distance to
                // the same distance as from eye->target. This just gives us a better position for look,
                // if we subsequently orbit eye about look, so that we don't orbit a position that's
                // suddenly a lot closer than the point we pivoted about on the surface of the last object
                // that we click-drag-pivoted on.

                const eyeTargetVec = subVec3(optionalTargetWorldPos, camera.eye, tempVec3a);
                const lenEyeTargetVec = lenVec3(eyeTargetVec);
                const eyeLookVec = mulVec3Scalar(normalizeVec3(subVec3(camera.look, camera.eye, tempVec3b)), lenEyeTargetVec);
                camera.look = [camera.eye[0] + eyeLookVec[0], camera.eye[1] + eyeLookVec[1], camera.eye[2] + eyeLookVec[2]];
            }

        } else if (camera.projection === OrthoProjectionType) {

            // - set ortho scale, getting the unprojected targetCanvasPos before and after, get that difference in a vector;
            // - get the vector in which we're dollying;
            // - add both vectors to camera eye and look.

            const worldPos1 = this.#unproject(targetCanvasPos, tempVec4a);

            camera.ortho.scale = camera.ortho.scale - dollyDelta;
            camera.ortho.clean(); // HACK

            const worldPos2 = this.#unproject(targetCanvasPos, tempVec4b);
            const offset = subVec3(worldPos2, worldPos1, tempVec4c);
            const eyeLookMoveVec = mulVec3Scalar(normalizeVec3(subVec3(camera.look, camera.eye, tempVec3a)), -dollyDelta, tempVec3b);
            const moveVec = addVec3(offset, eyeLookMoveVec, tempVec3c);

            camera.eye = [camera.eye[0] - moveVec[0], camera.eye[1] - moveVec[1], camera.eye[2] - moveVec[2]];
            camera.look = [camera.look[0] - moveVec[0], camera.look[1] - moveVec[1], camera.look[2] - moveVec[2]];
        }

        return dolliedThroughSurface;
    }

    #unproject(canvasPos: FloatArrayParam, worldPos: FloatArrayParam) {

        const camera = this.view.camera;
        const transposedProjectMat = camera.project.transposedProjMatrix;
        // @ts-ignore
        const Pt3 = transposedProjectMat.subarray(8, 12);
        // @ts-ignore
        const Pt4 = transposedProjectMat.subarray(12);
        const D = [0, 0, -1.0, 1];
        const screenZ = dotVec4(D, Pt3) / dotVec4(D, Pt4);

        camera.project.unproject(canvasPos, screenZ, screenPos, viewPos, worldPos);

        return worldPos;
    }

    destroy() {
    }
}

export {PanController};