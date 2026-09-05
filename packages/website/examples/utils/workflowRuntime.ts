import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import type {DataModel} from "@xeokit/sdk/model/data";
import type {Scene, SceneModel} from "@xeokit/sdk/model/scene";
import type {View} from "@xeokit/sdk/viewing/viewer";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {SceneRaycaster, getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import type {PickStrategy} from "@xeokit/sdk/spatial/picking";
import {fetchArrayBuffer, fetchJSON, mustOk, toNavigationPick} from "./standaloneRuntime.js";

export const IDENTITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export async function loadXGFModel(url: string, sceneModel: SceneModel, dataModel?: DataModel) {
  const result = await new XGFLoader().load({
    fileData: await fetchArrayBuffer(url),
    sceneModel,
    dataModel
  });
  if (result && result.ok === false) {
    throw new Error(result.error);
  }
}

export async function loadDataModel(url: string, dataModel: DataModel) {
  const result = await new DataModelImporter().load({
    fileData: await fetchJSON(url),
    dataModel
  });
  if (result && result.ok === false) {
    throw new Error(result.error);
  }
}

export function getSceneAABB(scene: Scene) {
  return getSceneCollisionIndex(scene).getSceneAABB();
}

export function fitViewToScene(view: View, scene: Scene) {
  new CameraFlightAnimation(view, {duration: 0}).flyTo({
    aabb: getSceneAABB(scene),
    fitFOV: 45,
    duration: 0
  });
}

export function createSceneRaycaster(scene: Scene) {
  return new SceneRaycaster(scene);
}

export function createModelNavigationPick(view: View, picker: PickStrategy) {
  return (_view: View, pickParams: { canvasPos: number[] }) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  };
}

export function positionPanelTopRight(selector: string) {
  const panel = document.querySelector<HTMLElement>(selector);
  if (!panel) {
    return;
  }
  Object.assign(panel.style, {
    top: "17px",
    right: "17px",
    bottom: "auto",
    left: "auto",
    transform: "none"
  });
}

export function mustElementValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export {mustOk};
