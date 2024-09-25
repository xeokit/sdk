
/**
 * @private
 */
export const RENDER_PASSES = {

    // Skipped - suppress rendering

    NOT_RENDERED: 0,

    // Draw color, or draw depth or normals for post-effects

    DRAW_OPAQUE: 1,
    DRAW_TRANSPARENT: 2,

    // Accents silhouette rendering - mutually exclusive modes

    SILHOUETTE_HIGHLIGHTED: 3,
    SILHOUETTE_SELECTED: 4,
    SILHOUETTE_XRAYED: 5,

    // Picking

    PICK: 6
};

