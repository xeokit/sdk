import {
  addVec3,
  cross3Vec3,
  createVec3Float64,
  mulVec3Scalar,
  normalizeVec3,
  subVec3
} from "../math/vector";
import {getAABB3Center, getAABB3Diag} from "../math/boundaries";
import type {View} from "../viewer";
import {getSceneCollisionIndex} from "../collision";

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

      const viewController = controllers.viewController;
      const VC = viewController.constructor; // ViewController class (static constants)

      // Build a single-key map from the current event to check which action was triggered.
      const tempKeyMap: boolean[] = [];
      tempKeyMap[e.keyCode] = true;

      const axisViewRight = viewController._isKeyDownForAction(VC.AXIS_VIEW_RIGHT, tempKeyMap);
      const axisViewBack = viewController._isKeyDownForAction(VC.AXIS_VIEW_BACK, tempKeyMap);
      const axisViewLeft = viewController._isKeyDownForAction(VC.AXIS_VIEW_LEFT, tempKeyMap);
      const axisViewFront = viewController._isKeyDownForAction(VC.AXIS_VIEW_FRONT, tempKeyMap);
      const axisViewTop = viewController._isKeyDownForAction(VC.AXIS_VIEW_TOP, tempKeyMap);
      const axisViewBottom = viewController._isKeyDownForAction(VC.AXIS_VIEW_BOTTOM, tempKeyMap);

      if (!axisViewRight && !axisViewBack && !axisViewLeft && !axisViewFront && !axisViewTop && !axisViewBottom) {
        return;
      }

      const sceneAABB = aabbIndex.getSceneAABB();
      const diag = getAABB3Diag(sceneAABB);
      const center = getAABB3Center(sceneAABB, tempVec3a);

      const camera = view.camera;
      const worldUp = view.viewer.scene.coordinateSystem.worldUp;

      const perspectiveDist = Math.abs(diag / Math.tan(controllers.cameraFlight.fitFOV * Math.PI / 180));
      const orthoScale = diag * 1.1;

      // Derive world-space axis directions from camera state and coordinate system.
      const forward = normalizeVec3(subVec3(camera.look, camera.eye, tempVec3b), tempVec3b);
      const right = normalizeVec3(cross3Vec3(forward, worldUp, tempVec3c), tempVec3c);

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
        setVec3(tempCameraTarget.up as Float64Array, normalizeVec3(forward, tempVec3d));

      } else if (axisViewBottom) {
        setVec3(tempCameraTarget.eye as Float64Array, addVec3(center, mulVec3Scalar(worldUp, -perspectiveDist, tempVec3d), tempVec3d));
        setVec3(tempCameraTarget.look as Float64Array, center);
        const negForward = mulVec3Scalar(forward, -1, tempVec3d);
        setVec3(tempCameraTarget.up as Float64Array, normalizeVec3(negForward, negForward));
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
