import {
  addVec3,
  cross3Vec3,
  createVec3Float64,
  dotVec3,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3
} from "../../../../base/math/vector";
import type {Vec3} from "../../../../base/math/vector";
import {getAABB3Center, getAABB3Diag} from "../../../../base/math/boundaries";
import type {View} from "../../../viewer";
import {getSceneCollisionIndex} from "../../../../spatial/collision";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();
const tempVec3d = createVec3Float64();

const tempCameraTarget = {
  eye: createVec3Float64(),
  look: createVec3Float64(),
  up: createVec3Float64()
};

/**
 * @private
 */
export class KeyboardAxisViewHandler {
  #view: View;
  #documentKeyDownHandler: (e: KeyboardEvent) => void;

  constructor(view: View, controllers: any, configs: any, states: any, updates: any) {

    this.#view = view;

    const aabbIndex = getSceneCollisionIndex(view.viewer.scene);

    document.addEventListener("keydown", this.#documentKeyDownHandler = (e: KeyboardEvent) => {

      if (!(configs.active && configs.pointerEnabled)) {
        return;
      }

      if (configs.keyboardEnabledOnlyIfMouseover && !states.mouseover) {
        return;
      }

      const modelNavigation = controllers.modelNavigation;
      const VC = modelNavigation.constructor; // ModelNavigationController class (static constants)

      // Build a single-key map from the current event to check which action was triggered.
      const tempKeyMap: boolean[] = [];
      tempKeyMap[e.keyCode] = true;

      const axisViewRight = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_RIGHT, tempKeyMap);
      const axisViewBack = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_BACK, tempKeyMap);
      const axisViewLeft = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_LEFT, tempKeyMap);
      const axisViewFront = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_FRONT, tempKeyMap);
      const axisViewTop = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_TOP, tempKeyMap);
      const axisViewBottom = modelNavigation._isKeyDownForAction(VC.AXIS_VIEW_BOTTOM, tempKeyMap);

      if (!axisViewRight && !axisViewBack && !axisViewLeft && !axisViewFront && !axisViewTop && !axisViewBottom) {
        return;
      }

      const sceneAABB = aabbIndex.getSceneAABB();
      const diag = getAABB3Diag(sceneAABB);
      const center = getAABB3Center(sceneAABB, tempVec3a);

      const camera = view.camera;
      const worldUp = view.viewer.scene.coordinateSystem.worldUp;

      // Guard a degenerate scene extent (empty / single-point AABB) so a
      // zero diagonal can't collapse eye onto look (a zero-length gaze
      // would NaN the camera basis).
      const safeDiag = (Number.isFinite(diag) && diag > 1e-6) ? diag : 1;
      const perspectiveDist = Math.abs(safeDiag / Math.tan(controllers.cameraFlight.fitFOV * Math.PI / 180));
      const orthoScale = safeDiag * 1.1;

      // Derive world-space axis directions from camera state and coordinate system.
      const forward = normalizeVec3(subVec3(camera.look, camera.eye, tempVec3b), tempVec3b);
      const right = cross3Vec3(forward, worldUp, tempVec3c);
      if (lenVec3(right) < 1e-6) {
        // Camera is looking (anti)parallel to worldUp — its heading is
        // undefined and cross() collapsed. Pick any horizontal axis so
        // `right` (and the top/bottom up fallback) stay well-defined.
        const ref: Vec3 = Math.abs(worldUp[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        cross3Vec3(worldUp, ref, right);
      }
      normalizeVec3(right, right);

      // Screen-up for a top/bottom view must be horizontal, since the gaze
      // runs along worldUp. Flatten the camera's current heading onto the
      // ground plane; if the camera is already looking straight up/down
      // that projection vanishes, so fall back to the (horizontal) right
      // axis. Using `forward` directly here is what produced a NaN basis
      // when up ended up parallel to the gaze.
      const horizontalHeading = (sign: number): Vec3 => {
        const d = dotVec3(forward, worldUp);
        const h: Vec3 = [
          (forward[0] - d * worldUp[0]) * sign,
          (forward[1] - d * worldUp[1]) * sign,
          (forward[2] - d * worldUp[2]) * sign,
        ];
        return lenVec3(h) < 1e-6 ? right : normalizeVec3(h, h);
      };

      // @ts-ignore — orthoScale is a valid CameraFlightAnimation target field
      tempCameraTarget.orthoScale = orthoScale;

      const setVec3 = (dest: Float64Array, src: ArrayLike<number>) => {
        dest[0] = src[0]; dest[1] = src[1]; dest[2] = src[2];
      };

      if (axisViewRight) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(right, perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, worldUp);

      } else if (axisViewBack) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(forward, perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, worldUp);

      } else if (axisViewLeft) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(right, -perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, worldUp);

      } else if (axisViewFront) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(forward, -perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, worldUp);

      } else if (axisViewTop) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(worldUp, perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, horizontalHeading(1));

      } else if (axisViewBottom) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(worldUp, -perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        setVec3(tempCameraTarget.up as Float64Array, horizontalHeading(-1));
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
