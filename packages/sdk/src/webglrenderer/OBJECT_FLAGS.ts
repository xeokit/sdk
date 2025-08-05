
import {ViewObject} from "../viewer";

/**
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
 * @private
 * @param viewObject
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
