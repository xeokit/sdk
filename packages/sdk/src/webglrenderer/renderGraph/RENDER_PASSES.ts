/**
 * Defines the rendering passes used by the `WebGLRenderer`.
 *
 * Each rendering pass represents a specific stage or mode in the rendering pipeline.
 * These passes are used to control how objects are rendered, including color, transparency,
 * silhouette effects, and picking.
 *
 * @private
 */
export const RENDER_PASSES = {

  /**
   * Skipped - suppress rendering.
   * Objects with this pass are not rendered.
   */
  NOT_RENDERED: 0,

  /**
   * Draw opaque objects.
   * Used for rendering objects with no transparency.
   */
  DRAW_OPAQUE: 1,

  /**
   * Draw transparent objects.
   * Used for rendering objects with transparency.
   */
  DRAW_TRANSPARENT: 2,

  /**
   * Render highlighted silhouettes.
   * Used to accentuate objects that are highlighted.
   */
  SILHOUETTE_HIGHLIGHTED: 3,

  /**
   * Render selected silhouettes.
   * Used to accentuate objects that are selected.
   */
  SILHOUETTE_SELECTED: 4,

  /**
   * Render x-rayed silhouettes.
   * Used to render objects with an x-ray effect.
   */
  SILHOUETTE_XRAYED: 5,

  /**
   * Picking pass.
   * Used for object picking to determine which object is under the cursor or selected.
   */
  PICK: 6
};
