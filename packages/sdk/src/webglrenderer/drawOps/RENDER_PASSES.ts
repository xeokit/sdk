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
   * Render opaque objects in their normal colors.
   */
  OPAQUE: 1,

  /**
   * Render transparent objects in their normal colors
   */
  TRANSPARENT: 2,

  /**
   * Render highlighted silhouettes.
   * Used to accentuate objects that are highlighted.
   */
  HIGHLIGHTED: 3,

  /**
   * Render selected silhouettes.
   * Used to accentuate objects that are selected.
   */
  SELECTED: 4,

  /**
   * Render x-rayed silhouettes.
   * Used to render objects with an x-ray effect.
   */
  XRAYED: 5,

  /**
   * Picking pass.
   * Used for object picking to determine which object is under the cursor or selected.
   */
  PICK: 6
};


/**
 * Type representing the possible values of rendering passes.
 */
export type RenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];