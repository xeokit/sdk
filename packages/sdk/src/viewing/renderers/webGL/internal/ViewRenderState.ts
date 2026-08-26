import {View} from "../../../viewer";
import {RenderBuffers} from "./RenderBuffers";
import {RenderContext} from "./RenderContext";
import {PickManager} from "./pickManager/PickManager";
import {RenderManager} from "./renderManager/RenderManager";

/**
 * Renderer-side wrapper for a {@link viewing!viewer.View | View}.
 *
 * A {@link ViewRenderState} bundles the per-view resources needed by the WebGL renderer, including:
 * - A reference to the logical {@link viewing!viewer.View | View} (DOM element, size, index, etc.)
 * - Per-view {@link RenderBuffers} (eg. snapshot buffers, depth buffers, etc.)
 * - Cached DOM bounds used when repositioning/resizing the shared WebGL canvas
 *
 * @remarks
 * The renderer uses a single shared WebGL canvas that is moved/resized to the currently active view.
 * {@link ViewRenderState} stores per-view buffers so inactive views can still keep a last-frame snapshot.
 *
 * @internal
 */
export class ViewRenderState {

  /**
   * The logical view this renderer view represents.
   */
  view: View;

  /**
   * Per-view render targets/buffers (eg. snapshot render buffers).
   */
  renderBuffers: RenderBuffers;

  /**
   * Cached DOM bounds of {@link view.htmlElement}.
   *
   * @remarks
   * This is typically used when generating snapshots or when restoring the canvas position
   * during view activation/deactivation.
   */
  saveCanvasBoundary: DOMRect;

  /**
   * Whether this view is currently active (ie. the shared WebGL canvas is positioned over it).
   *
   * @remarks
   * Activation is managed by the view manager; this flag is primarily informational and may be
   * expanded in the future for view-specific optimizations.
   */
  private _active: boolean;

  /** Shared render context (WebGL state + shared resources). */
  private _renderContext: RenderContext;

  /** Picking subsystem used for this view. */
  private _pickManager: PickManager;

  /** Render subsystem used to render this view. */
  private _renderManager: RenderManager;

  /**
   * Creates a {@link ViewRenderState}.
   *
   * @param renderContext - Shared render context used for WebGL access and shared resources.
   * @param pickManager - Picking manager used by this view.
   * @param renderManager - Render manager used to draw this view.
   * @param view - The logical view being wrapped.
   */
  constructor(
    renderContext: RenderContext,
    pickManager: PickManager,
    renderManager: RenderManager,
    view: View
  ) {
    this._renderContext = renderContext;
    this._pickManager = pickManager;
    this._renderManager = renderManager;

    this.view = view;
    this._active = false;

    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBuffers = new RenderBuffers(renderContext, view);
  }

  /**
   * Begins a snapshot operation for this view.
   *
   * Intended to prepare any render buffers and state required to render the view into an offscreen
   * snapshot target (eg. for displaying the last rendered frame when the view is inactive).
   *
   * @param params - Optional snapshot parameters.
   * @param params.width - Snapshot width in CSS pixels.
   * @param params.height - Snapshot height in CSS pixels.
   *
   * @remarks
   * This method is currently a stub. A typical implementation might:
   * - allocate/resize a "snapshot" render buffer in {@link renderBuffers}
   * - render the view using {@link RenderManager}
   * - read pixels to an image for display in the view's HTML element (if it is an `<img>`)
   */
  beginSnapshot(params?: { width: number; height: number }) {
    // TODO: implement snapshot workflow (allocate buffer, render, read image, etc.)
  }

  /**
   * Releases per-view rendering resources.
   *
   * @remarks
   * After calling this, the instance should not be used again.
   */
  destroy() {
    this.renderBuffers?.destroy();
    this.renderBuffers = null;
    this._renderManager = null;
    this._pickManager = null;
  }
}
