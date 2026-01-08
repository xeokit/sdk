/**
 * # Render Manager for WebGL Renderer
 *
 * This module provides the core rendering orchestration for the xeokit WebGL renderer.
 *
 * @remarks
 * - The {@link RenderManager} coordinates the rendering pipeline, managing draw calls, render passes, and integration with the mesh and GPU memory managers.
 * - Handles WebGL context restoration, extension activation, and per-view rendering.
 * - Used internally by the renderer; not typically accessed directly by application code.
 *
 * ## Key Classes
 * - {@link RenderManager}: Main class for managing the rendering process.
 *
 * @module renderManager
 * @internal
 */

export * from "./RenderManager";
