/**
 * Binds an item to a {@link KdNode3}.
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