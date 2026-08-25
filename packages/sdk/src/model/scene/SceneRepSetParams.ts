import type {SceneRepParams} from "./SceneRepParams";

/**
 * Declarative selection hints for a representation set.
 *
 * The model stores this metadata only. It does not store the active
 * representation, because different views can choose different representations
 * at the same time.
 */
export interface SceneRepSetSelectionParams {
  /**
   * Selection strategy name.
   *
   * `"projectedSize"` means the representation ranges describe projected
   * screen size thresholds.
   */
  strategy: "projectedSize";

  /**
   * Optional hysteresis width in pixels for future selection logic.
   */
  hysteresisPixels?: number;
}

/**
 * Parameters for a representation set in a {@link SceneModel}.
 *
 * A representation set groups alternative representations of the same logical
 * content. The representation IDs are model/application defined; names such as
 * `"detailed"`, `"shell"` or `"impostor"` have no built-in meaning.
 */
export interface SceneRepSetParams {
  /**
   * Representation set ID, unique within its SceneModel.
   */
  id: string;

  /**
   * ID of the representation to use when no selection policy applies.
   */
  defaultRepId: string;

  /**
   * Alternative representations in this representation set.
   */
  reps: SceneRepParams[];

  /**
   * Optional declarative selection metadata.
   */
  selection?: SceneRepSetSelectionParams;
}
