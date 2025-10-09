import {ViewObject} from "../../../viewer";

/**
 * Bitmask flags representing various object states in the `WebGLRenderer`.
 *
 * These flags are used to define and track the rendering, interaction, and visibility
 * states of objects in the scene. Each flag corresponds to a specific feature or property
 * of an object.
 *
 * @property {number} VISIBLE - Indicates that the object is visible.
 * @property {number} CULLED - Indicates that the object is culled (not rendered).
 * @property {number} PICKABLE - Indicates that the object can be picked (e.g., for selection).
 * @property {number} CLIPPABLE - Indicates that the object can be clipped by section planes.
 * @property {number} COLLIDABLE - Indicates that the object can participate in collision detection.
 * @property {number} CAST_SHADOW - Indicates that the object can cast shadows.
 * @property {number} RECEIVE_SHADOW - Indicates that the object can receive shadows.
 * @property {number} XRAYED - Indicates that the object is rendered with an x-ray effect.
 * @property {number} HIGHLIGHTED - Indicates that the object is highlighted.
 * @property {number} SELECTED - Indicates that the object is selected.
 * @property {number} BACKFACES - Indicates that the object's backfaces are rendered.
 * @property {number} TRANSPARENT - Indicates that the object is rendered with transparency.
 *
 * @private
 */
export const OBJECT_FLAGS = {
  VISIBLE: 1,
  CULLED: 1 << 2,
  PICKABLE: 1 << 3,
  CLIPPABLE: 1 << 4,
  COLLIDABLE: 1 << 5,
  CAST_SHADOW: 1 << 6,
  RECEIVE_SHADOW: 1 << 7,
  XRAYED: 1 << 8,
  HIGHLIGHTED: 1 << 9,
  SELECTED: 1 << 10,
  BACKFACES: 1 << 11,
  TRANSPARENT: 1 << 12
};

/**
 * Creates a bitmask of object flags based on the properties of a `ViewObject`.
 *
 * This function evaluates the state of the given `ViewObject` and sets the corresponding
 * flags in the bitmask. The resulting bitmask can be used to track the object's state
 * in the rendering pipeline.
 *
 * @param {ViewObject} viewObject - The `ViewObject` to evaluate.
 * @returns {number} A bitmask representing the object's state.
 *
 * @private
 */
export function createObjectFlags(viewObject: ViewObject): number {
  let flags = 0;
  if (viewObject.visible) flags |= OBJECT_FLAGS.VISIBLE;
  if (viewObject.highlighted) flags |= OBJECT_FLAGS.HIGHLIGHTED;
  if (viewObject.xrayed) flags |= OBJECT_FLAGS.XRAYED;
  if (viewObject.selected) flags |= OBJECT_FLAGS.SELECTED;
  if (viewObject.culled) flags |= OBJECT_FLAGS.CULLED;
  if (viewObject.clippable) flags |= OBJECT_FLAGS.CLIPPABLE;
  if (viewObject.collidable) flags |= OBJECT_FLAGS.COLLIDABLE;
  if (viewObject.pickable) flags |= OBJECT_FLAGS.PICKABLE;
  return flags;
}

/**
 * Creates a default bitmask of object flags.
 *
 * This function initializes a bitmask with default flags for a new object.
 * The default flags indicate that the object is visible, clippable, collidable,
 * and pickable.
 *
 * @returns {number} A bitmask representing the default object state.
 *
 * @private
 */
export function createDefaultObjectFlags(): number {
  let flags = 0;
  flags |= OBJECT_FLAGS.VISIBLE;
  flags |= OBJECT_FLAGS.CLIPPABLE;
  flags |= OBJECT_FLAGS.COLLIDABLE;
  flags |= OBJECT_FLAGS.PICKABLE;
  return flags;
}
