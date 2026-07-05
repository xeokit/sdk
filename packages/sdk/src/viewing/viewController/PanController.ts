import {
  addVec3,
  createVec3Float64, createVec4Float32,
  dotVec4,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3,
  type Vec2, type Vec3
} from "../../base/math/vector";
import {OrthoProjectionType, PerspectiveProjectionType} from "../../base/constants";
import type {View} from "../viewer";

const screenPos = createVec3Float64();
const viewPos = createVec3Float64();

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();
const tempVec3d = createVec3Float64();
const tempVec3e = createVec3Float64();
const tempVec3f = createVec3Float64();

/**
 * @private
 */
class PanController {

  #view: View;

  constructor(view) {
    this.#view = view;
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
  dollyToCanvasPos(optionalTargetWorldPos, targetCanvasPos, dollyDelta) {

    let dolliedThroughSurface = false;

    const camera = this.#view.camera;

    if (optionalTargetWorldPos) {
      const eyeToWorldPosVec = subVec3(optionalTargetWorldPos, camera.eye, tempVec3a);
      const eyeWorldPosDist = lenVec3(eyeToWorldPosVec);
      dolliedThroughSurface = (eyeWorldPosDist < dollyDelta);
    }

    if (camera.projectionType === PerspectiveProjectionType) {

      camera.orthoProjection.scale = camera.orthoProjection.scale - dollyDelta;

      const unprojectedWorldPos = this._unproject(targetCanvasPos, tempVec3a);
      const offset = subVec3(unprojectedWorldPos, camera.eye, tempVec3b);
      const moveVec = mulVec3Scalar(normalizeVec3(offset), -dollyDelta, tempVec3c);

      camera.eye = [camera.eye[0] - moveVec[0], camera.eye[1] - moveVec[1], camera.eye[2] - moveVec[2]];
      camera.look = [camera.look[0] - moveVec[0], camera.look[1] - moveVec[1], camera.look[2] - moveVec[2]];

      if (optionalTargetWorldPos) {

        // Subtle UX tweak - if we have a target World position, then set camera eye->look distance to
        // the same distance as from eye->target. This just gives us a better position for look,
        // if we subsequently orbit eye about look, so that we don't orbit a position that's
        // suddenly a lot closer than the point we pivoted about on the surface of the last object
        // that we click-drag-pivoted on.

        const eyeTargetVec = subVec3(optionalTargetWorldPos, camera.eye, tempVec3d);
        const lenEyeTargetVec = lenVec3(eyeTargetVec);
        const eyeLookVec = mulVec3Scalar(normalizeVec3(subVec3(camera.look, camera.eye, tempVec3e)), lenEyeTargetVec);
        camera.look = [camera.eye[0] + eyeLookVec[0], camera.eye[1] + eyeLookVec[1], camera.eye[2] + eyeLookVec[2]];
      }

    } else if (camera.projectionType === OrthoProjectionType) {

      // - set ortho scale, getting the unprojected targetCanvasPos before and after, get that difference in a vector;
      // - get the vector in which we're dollying;
      // - add both vectors to camera eye and look.

      const worldPos1 = this._unproject(targetCanvasPos, tempVec3a);

      camera.orthoProjection.scale = camera.orthoProjection.scale - dollyDelta;

      ////////////////////////////// TODO
      // camera.orthoProjection._update(); // HACK

      const worldPos2 = this._unproject(targetCanvasPos, tempVec3b);
      const offset = subVec3(worldPos2, worldPos1, tempVec3c);
      const eyeLookMoveVec = mulVec3Scalar(normalizeVec3(subVec3(camera.look, camera.eye, tempVec3d)), -dollyDelta, tempVec3e);
      const moveVec = addVec3(offset, eyeLookMoveVec, tempVec3f);

      camera.eye = [camera.eye[0] - moveVec[0], camera.eye[1] - moveVec[1], camera.eye[2] - moveVec[2]];
      camera.look = [camera.look[0] - moveVec[0], camera.look[1] - moveVec[1], camera.look[2] - moveVec[2]];
    }

    return dolliedThroughSurface;
  }

  private _unproject(canvasPos: Vec2, worldPos: Vec3):Vec3 {

    const camera = this.#view.camera;
    const transposedProjectMat = camera.projection.transposedProjMatrix;

    // @ts-ignore
    const Pt3 = transposedProjectMat.subarray(8, 12);
    // @ts-ignore
    const Pt4 = transposedProjectMat.subarray(12);
    const D = createVec4Float32([0, 0, -1.0, 1]);
    const screenZ = dotVec4(D, Pt3) / dotVec4(D, Pt4);

    camera.projection.unproject(canvasPos, screenZ, screenPos, viewPos, worldPos);

    return worldPos;
  }

  destroy() {
  }
}

export {PanController};
