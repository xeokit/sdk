
/**
 * @private
 */
export const SCENE_OBJECT_FLAGS = {
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
