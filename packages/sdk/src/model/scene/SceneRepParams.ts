/**
 * Projected-size range hint for a representation.
 *
 * This metadata is declarative. It does not select a representation by itself;
 * viewing-layer code can use it later when a representation set declares a
 * projected-size selection strategy.
 */
export interface SceneRepRangeParams {
  /**
   * Minimum projected size, in pixels, for which this representation is a
   * candidate.
   */
  minPixels?: number;

  /**
   * Maximum projected size, in pixels, for which this representation is a
   * candidate.
   */
  maxPixels?: number;
}

/**
 * Parameters for one representation in a {@link SceneRepSet}.
 *
 * A representation is one alternative object set for the same logical model
 * content. It references {@link SceneObject | SceneObjects}; it does not own
 * them and does not reference raw geometry or mesh resources.
 */
export interface SceneRepParams {
  /**
   * Representation ID, unique within its representation set.
   */
  id: string;

  /**
   * SceneObject IDs included in this representation.
   */
  objectIds: string[];

  /**
   * Optional projected-size selection hint.
   */
  range?: SceneRepRangeParams;
}
