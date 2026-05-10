/**
 * Visitor callback. Return `false` to stop iteration early; any other
 * return value continues.
 */
export type SceneCollisionVisitor<T> = (item: T) => boolean | void;
