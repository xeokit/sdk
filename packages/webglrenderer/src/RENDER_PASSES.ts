
/**
 * @private
 */
export const RENDER_PASSES = {

    // Skipped - suppress rendering

    NOT_RENDERED: 0,

    // Normal rendering - mutually exclusive modes

    COLOR_OPAQUE: 1,
    COLOR_TRANSPARENT: 2,

    // Accents silhouette rendering - mutually exclusive modes

    SILHOUETTE_HIGHLIGHTED: 3,
    SILHOUETTE_SELECTED: 4,
    SILHOUETTE_XRAYED: 5,

    // Picking

    PICK: 6
};

