/**
 * Defines the rendering passes used by the `WebGLRenderer`.
 *
 * Each rendering pass represents a specific stage or mode in the rendering pipeline.
 * These passes are used to control how objects are rendered, including color, transparency,
 * silhouette effects, and picking.
 *
 * @internal
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
   * Render opaque objects using their resolved ViewStyleBin treatment.
   */
  STYLE_BIN_OPAQUE: 3,

  /**
   * Render transparent objects using their resolved ViewStyleBin treatment.
   */
  STYLE_BIN_TRANSPARENT: 4,

  /**
   * Picking pass.
   * Used for object picking to determine which object is under the cursor or selected.
   */
  PICK: 5,

  /**
   * Snap-init pass — populates the snap framebuffer's depth and view-position
   * outputs from triangle surfaces. Sets up the scene under a small viewport
   * centred on the cursor so the subsequent {@link RENDER_PASSES.SNAP} pass
   * can z-test vertex / edge primitives against real geometry.
   */
  SNAP_INIT: 6,

  /**
   * Snap pass — rasterises vertices (as 1-pixel points) or edges (as
   * 1-pixel lines) into the same FBO populated by {@link RENDER_PASSES.SNAP_INIT},
   * but only where they pass the depth test. The fragment shader writes
   * the high-precision view-space position so JS can read back and pick
   * the nearest snap target to the cursor.
   */
  SNAP: 7,
};


/**
 * Type representing the possible values of rendering passes.
 */
export type RenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];
