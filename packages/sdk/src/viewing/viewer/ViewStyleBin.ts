import {SDKErrorType, type SDKResult} from "../../base/core";
import {Effect} from "./Effect";
import type {View} from "./View";
import type {ViewObject} from "./ViewObject";
import type {ViewStyleBinParams} from "./ViewStyleBinParams";

/**
 * A named user-defined bin of ViewObjects with a configurable draw style.
 */
class ViewStyleBin {

  public readonly view: View;
  public readonly id: string;
  public readonly material: Effect;
  private readonly _objects: { [key: string]: ViewObject } = {};

  private _objectIds: string[] | null = null;
  private _numObjects = 0;
  private _priority: number;
  private _enabled: boolean;
  public destroyed = false;

  constructor(view: View, params: ViewStyleBinParams) {
    this.view = view;
    this.id = params.id;
    this.material = new Effect(view, params, () => this._definitionUpdated());
    this._priority = params.priority ?? 0;
    this._enabled = params.enabled !== false;
  }

  /**
   * Map of ViewObjects that currently belong to this style bin.
   *
   * This is a read-only mirror of per-ViewObject style-bin membership.
   * Use {@link ViewStyleBin.setObjects | setObjects},
   * {@link View.setObjectsInStyleBin | View.setObjectsInStyleBin} or
   * {@link ViewObject.setStyleBin | ViewObject.setStyleBin} to update it.
   */
  get objects(): Readonly<{ [key: string]: ViewObject }> {
    return this._objects;
  }

  get objectIds(): readonly string[] {
    if (!this._objectIds) {
      this._objectIds = Object.keys(this._objects);
    }
    return this._objectIds;
  }

  get numObjects(): number {
    return this._numObjects;
  }

  get priority(): number {
    return this._priority;
  }

  set priority(value: number) {
    if (this._priority === value) {
      return;
    }
    this._priority = value;
    this.view.styleBins._sort();
    this._definitionUpdated();
    this.view.needsRender();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
    this._definitionUpdated();
    this.view.needsRender();
  }

  setObjects(objectIds: readonly string[], membership: boolean): SDKResult<boolean> {
    let changed = false;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = this.view.objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      const result = viewObject.setStyleBin(this.id, membership);
      if (result.ok === false) {
        return result;
      }
      if (result.value) {
        changed = true;
      }
    }
    return {ok: true, value: changed};
  }

  clear(): SDKResult<boolean> {
    return this.setObjects(this.objectIds.slice(), false);
  }

  hasObject(objectId: string): boolean {
    return !!this._objects[objectId];
  }

  private _objectMembershipUpdated(viewObject: ViewObject, membership: boolean): void {
    const objectId = viewObject.id;
    if (membership) {
      if (this._objects[objectId]) {
        return;
      }
      this._objects[objectId] = viewObject;
      this._numObjects++;
    } else {
      if (!this._objects[objectId]) {
        return;
      }
      delete this._objects[objectId];
      this._numObjects--;
    }
    this._objectIds = null;
  }

  private _definitionUpdated(): void {
    const objectIds = this.objectIds;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = this._objects[objectIds[i]];
      if (viewObject) {
        this.view.viewer.events.onViewObjectStyleBinChanged.dispatch(this.view, {
          viewObject,
          styleBinId: this.id,
          membership: true
        });
      }
    }
  }

  fromParams(params: Partial<ViewStyleBinParams>): SDKResult<void> {
    if (params.id !== undefined && params.id !== this.id) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[ViewStyleBin.fromParams] Style bin ID cannot be changed"
      };
    }
    if (params.priority !== undefined) this.priority = params.priority;
    if (params.enabled !== undefined) this.enabled = params.enabled;
    const materialResult = this.material.fromParams(params);
    if (materialResult.ok === false) {
      return materialResult;
    }
    return {ok: true, value: undefined};
  }

  toParams(): SDKResult<ViewStyleBinParams> {
    const materialParams = this.material.toParams();
    if (materialParams.ok === false) {
      return materialParams as SDKResult<ViewStyleBinParams>;
    }
    return {
      ok: true,
      value: {
        ...materialParams.value,
        id: this.id,
        priority: this.priority,
        enabled: this.enabled
      }
    };
  }

  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewStyleBin.destroy] ViewStyleBin already destroyed"
      };
    }
    const clearResult = this.clear();
    if (clearResult.ok === false) {
      return clearResult as SDKResult<void>;
    }
    this.destroyed = true;
    return {ok: true, value: undefined};
  }
}

export {ViewStyleBin};
