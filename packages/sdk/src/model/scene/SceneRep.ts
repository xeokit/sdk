import type {SceneRepParams, SceneRepRangeParams} from "./SceneRepParams";
import type {SceneRepSet} from "./SceneRepSet";

/**
 * One representation in a {@link SceneRepSet}.
 *
 * A representation references one or more {@link SceneObject | SceneObjects}
 * that can stand in for the same logical content as the other representations
 * in the same representation set. It is generic metadata: it is not limited to
 * LOD, shells or impostors.
 */
export class SceneRep {
  /**
   * Representation ID, unique within its representation set.
   */
  public readonly id: string;

  /**
   * The representation set that contains this representation.
   */
  public readonly repSet: SceneRepSet;

  /**
   * SceneObject IDs included in this representation.
   */
  public readonly objectIds: string[];

  /**
   * Optional projected-size selection hint.
   */
  public readonly range?: SceneRepRangeParams;

  /**
   * @private
   */
  constructor(repSet: SceneRepSet, params: SceneRepParams) {
    this.repSet = repSet;
    this.id = params.id;
    this.objectIds = params.objectIds.slice();
    this.range = params.range ? {...params.range} : undefined;
  }

  /**
   * Gets this representation as parameters.
   */
  public toParams(): SceneRepParams {
    return {
      id: this.id,
      objectIds: this.objectIds.slice(),
      range: this.range ? {...this.range} : undefined
    };
  }
}
