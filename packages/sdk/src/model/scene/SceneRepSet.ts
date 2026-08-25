import {SDKErrorType, type SDKResult} from "../../base/core";
import type {SceneModel} from "./SceneModel";
import {SceneRep} from "./SceneRep";
import type {SceneRepSetParams, SceneRepSetSelectionParams} from "./SceneRepSetParams";

/**
 * A representation set in a {@link SceneModel}.
 *
 * A representation set declares alternative representations of the same logical
 * content. It stores metadata only: it does not own referenced SceneObjects and
 * does not store the currently active representation.
 */
export class SceneRepSet {
  /**
   * Representation set ID, unique within its SceneModel.
   */
  public readonly id: string;

  /**
   * SceneModel that owns this representation set.
   */
  public readonly model: SceneModel;

  /**
   * Representations in this representation set, keyed by representation ID.
   */
  public readonly reps: {[id: string]: SceneRep} = {};

  /**
   * ID of the default representation.
   */
  public readonly defaultRepId: string;

  /**
   * Optional declarative selection metadata.
   */
  public readonly selection?: SceneRepSetSelectionParams;

  /**
   * True after this representation set has been destroyed.
   */
  public destroyed = false;

  /**
   * @private
   */
  constructor(model: SceneModel, params: SceneRepSetParams) {
    this.model = model;
    this.id = params.id;
    this.defaultRepId = params.defaultRepId;
    this.selection = params.selection ? {...params.selection} : undefined;
    for (let i = 0, len = params.reps.length; i < len; i++) {
      const rep = new SceneRep(this, params.reps[i]);
      this.reps[rep.id] = rep;
    }
  }

  /**
   * Gets the default representation.
   */
  public get defaultRep(): SceneRep {
    return this.reps[this.defaultRepId];
  }

  /**
   * Gets this representation set as parameters.
   */
  public toParams(): SceneRepSetParams {
    return {
      id: this.id,
      defaultRepId: this.defaultRepId,
      selection: this.selection ? {...this.selection} : undefined,
      reps: Object.keys(this.reps).map((id) => this.reps[id].toParams())
    };
  }

  /**
   * Destroys this representation set.
   *
   * Referenced SceneObjects are not destroyed.
   */
  public destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneRepSet.destroy] SceneRepSet already destroyed"
      });
    }
    this.model._destroyRepSet(this);
    this.destroyed = true;
    return {
      ok: true,
      value: undefined
    };
  }
}
