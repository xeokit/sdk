import type {Viewer} from "../viewer";

/**
 * Parameters for {@link RepresentationLODSelector}.
 */
export interface RepresentationLODSelectorParams {
  /**
   * Viewer whose attached Scene contains SceneModel representation sets.
   */
  viewer: Viewer;

  /**
   * Initial enabled state.
   *
   * When disabled, all LOD suppression managed by the selector is cleared.
   *
   * Default is `true`.
   */
  enabled?: boolean;
}
