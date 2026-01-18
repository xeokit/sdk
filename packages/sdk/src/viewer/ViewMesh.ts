import {SceneMesh} from "../scene";
import {ViewObject} from "./ViewObject";
import {SDKErrorType} from "../core";

export class ViewMesh {

  private viewObject: ViewObject;
  private sceneMesh: SceneMesh;
  private _visible: boolean;

  constructor (viewObject:ViewObject, sceneMesh: SceneMesh) {
    this.viewObject = viewObject;
    this.sceneMesh = sceneMesh;
    this._visible = true;
  }

  set visible(visible: boolean) {
    if (this._visible === visible) {
      return;
    }
    this._visible = visible;
    if (this.viewObject.destroyed) {
      this.viewObject.layer.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewObject.setMeshVisible] ViewObject already destroyed"
      });
      return;
    }
   // this.viewObject.layer.view.viewer.events.viewMeshVisibilityChanged.dispatch(this.viewObject.layer.view, this, visible);
  }

  get visible(): boolean {
    return this._visible;
  }
}
