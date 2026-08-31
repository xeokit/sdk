import {SDKErrorType, type SDKResult} from "../../base/core";
import type {View} from "./View";
import type {ViewObject} from "./ViewObject";
import {ViewStyleBin} from "./ViewStyleBin";
import type {ViewStyleBinParams} from "./ViewStyleBinParams";

type ViewStyleBinInternals = {
  _objectMembershipUpdated(viewObject: ViewObject, membership: boolean): void;
};

/**
 * Owns the user-defined object style bins for a View.
 */
class ViewStyleBins {

  public readonly view: View;
  public readonly bins: { [key: string]: ViewStyleBin } = {};
  private _list: ViewStyleBin[] = [];

  constructor(view: View, params: ViewStyleBinParams[] = []) {
    this.view = view;
    for (const binParams of params) {
      const result = this.create(binParams);
      if (result.ok === false) {
        this.view.viewer.logError(result);
      }
    }
  }

  get list(): readonly ViewStyleBin[] {
    return this._list;
  }

  create(params: ViewStyleBinParams): SDKResult<ViewStyleBin> {
    if (!params.id) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[ViewStyleBins.create] Style bin ID expected"
      };
    }
    const existing = this.bins[params.id];
    if (existing) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[ViewStyleBins.create] Style bin already exists: ${params.id}`
      };
    }
    const bin = new ViewStyleBin(this.view, params);
    const result = bin.fromParams(params);
    if (result.ok === false) {
      bin.destroy();
      return result as SDKResult<ViewStyleBin>;
    }
    this.bins[bin.id] = bin;
    this._list.push(bin);
    this._sort();
    this.view.needsRender();
    return {ok: true, value: bin};
  }

  get(id: string): ViewStyleBin | null {
    return this.bins[id] ?? null;
  }

  destroy(id: string): SDKResult<boolean> {
    const bin = this.bins[id];
    if (!bin) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[ViewStyleBins.destroy] Style bin not found: ${id}`
      };
    }
    const result = bin.destroy();
    if (result.ok === false) {
      return result as SDKResult<boolean>;
    }
    delete this.bins[id];
    const index = this._list.indexOf(bin);
    if (index !== -1) {
      this._list.splice(index, 1);
    }
    this.view.needsRender();
    return {ok: true, value: true};
  }

  setObjects(id: string, objectIds: readonly string[], membership: boolean): SDKResult<boolean> {
    const bin = this.bins[id];
    if (!bin) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[ViewStyleBins.setObjects] Style bin not found: ${id}`
      };
    }
    return bin.setObjects(objectIds, membership);
  }

  getObjectIds(id: string): readonly string[] {
    return this.bins[id]?.objectIds ?? [];
  }

  /**
   * @internal
   */
  _objectMembershipUpdated(styleBinId: string, viewObject: ViewObject, membership: boolean) {
    (this.bins[styleBinId] as unknown as ViewStyleBinInternals | undefined)?._objectMembershipUpdated(viewObject, membership);
  }

  /**
   * @internal
   */
  _sort() {
    this._list.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  toParams(): SDKResult<ViewStyleBinParams[]> {
    const value: ViewStyleBinParams[] = [];
    for (const bin of this._list) {
      const result = bin.toParams();
      if (result.ok === false) {
        return result as SDKResult<ViewStyleBinParams[]>;
      }
      value.push(result.value);
    }
    return {ok: true, value};
  }
}

export {ViewStyleBins};
