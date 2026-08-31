import type {EffectParams} from "./EffectParams";

/**
 * Parameters for a user-defined object style bin in a {@link View}.
 */
export interface ViewStyleBinParams extends EffectParams {
  /**
   * Unique ID of the style bin within the View.
   */
  id: string;

  /**
   * Conflict precedence when multiple enabled bins contain the same ViewObject.
   *
   * Higher-priority bins win. Equal priorities are resolved deterministically
   * by style-bin ID.
   */
  priority?: number;

  /**
   * Whether this style bin participates in rendering.
   */
  enabled?: boolean;

}
