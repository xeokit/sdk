/**
 * Binds an item to a {@link KdNode3}.
 *
 * See {@link kdtree3 | @xeokit/sdk/kdtree3} for usage.
 */
export interface KdItem3D {

  /**
   * A unique, sequential numeric ID for this KDItem within its KdTree3.
   */
  index: number;

  /**
   * The item stored in this KDItem.
   */
  item: any;
}
