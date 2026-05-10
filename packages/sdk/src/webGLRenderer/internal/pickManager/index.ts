/**
 * # Pick Manager for WebGL Renderer
 *
 * This module provides object picking utilities for the xeokit WebGL renderer.
 *
 * @remarks
 * - The {@link PickManager} enables hit-testing and selection of scene objects using screen-space or ray-based picking.
 * - Integrates with the renderer's GPU memory and batching system for efficient, accurate picking.
 * - Used internally by the renderer; not typically accessed directly by application code.
 *
 * ## Key Classes
 * - {@link PickManager}: Main class for managing picking operations.
 *
 * @module pickManager
 * @internal
 */

export * from "./PickManager";
