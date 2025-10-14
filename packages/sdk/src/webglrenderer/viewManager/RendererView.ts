import {PickParams, PickResult, View} from "../../viewer";
import {RenderBuffers} from "./RenderBuffers";
import {ViewManager} from "./ViewManager";
import {RenderContext} from "../RenderContext";
import {ViewRendererProxy} from "../../viewer/ViewRendererProxy";
import {PickManager} from "./pickManager/PickManager";
import {RenderManager} from "./renderManager/RenderManager";

/**
 * Represents a renderer view that manages rendering, picking, and state for a specific view.
 * Implements the ViewRendererProxy interface.
 *
 * @private
 */
export class RendererView implements ViewRendererProxy {

  /** The associated view instance. */
  view: View;

  /** Provides render buffers for this view. */
  renderBuffers: RenderBuffers;

  /** Whether the view is currently active. */
  private _active: boolean;

  /** Whether transparency is enabled for the view. */
  private _transparencyEnabled: boolean;

  /** Whether the canvas is transparent. */
  private _canvasTransparent: boolean;

  /** Whether screen-space ambient occlusion (SSAO) is enabled. */
  private _saoEnabled: boolean;

  /** Whether edge rendering is enabled. */
  private _edgesEnabled: boolean;

  /** Whether transparency rendering is enabled. */
  private _transparentEnabled: boolean;

  /** Whether physically-based rendering (PBR) is enabled. */
  private _pbrEnabled: boolean;

  /** The saved canvas boundary dimensions. */
  saveCanvasBoundary: DOMRect;

  /** The view manager responsible for managing this view. */
  private viewManager: ViewManager;

  /** The rendering context for this view. */
  private _renderContext: RenderContext;
  private _pickManager: PickManager;
  private _renderManager: RenderManager;

  /**
   * Initializes a new RendererView instance.
   *
   * @param viewManager The view manager responsible for this view.
   * @param renderContext The rendering context for this view.
   * @param pickManager
   * @param renderManager
   * @param view The associated view instance.
   */
  constructor(
      viewManager: ViewManager,
      renderContext: RenderContext,
      pickManager: PickManager,
      renderManager: RenderManager,
      view: View ) {
    this.viewManager = viewManager;
    this._renderContext = renderContext;
    this._pickManager = pickManager;
    this._renderManager = renderManager;
    this.view = view;
    this._active = false;
    this._transparencyEnabled = true;
    this.needsRender();
    this._canvasTransparent = false;
    this._pbrEnabled = false;
    this._saoEnabled = false;
    this._edgesEnabled = true;
    this._transparentEnabled = true;
    this.saveCanvasBoundary = view.htmlElement.getBoundingClientRect();
    this.renderBuffers = new RenderBuffers(renderContext, view);
  }

  /**
   * Activates the view, making it the current active view.
   */
  activate() {
    if (this._active) {
      return;
    }
    this._active = true;
    this.viewManager.activateView(this);
  }

  /**
   * Marks the view as needing to be rendered.
   */
  needsRender(): void {
    this._renderContext.viewFlags[this.view.viewIndex].needsRender = true;
  }

  /**
   * Gets whether transparency is enabled for the view.
   */
  get transparencyEnabled(): boolean {
    return this._transparencyEnabled;
  }

  /**
   * Sets whether transparency is enabled for the view.
   * @param value Whether transparency should be enabled.
   */
  set transparencyEnabled( value: boolean ) {
    this._transparencyEnabled = value;
    this.needsRender();
  }

  /**
   * Gets whether the canvas is transparent.
   */
  get canvasTransparent(): boolean {
    return this._canvasTransparent;
  }

  /**
   * Sets whether the canvas is transparent.
   * @param value Whether the canvas should be transparent.
   */
  set canvasTransparent( value: boolean ) {
    this._canvasTransparent = value;
    this.needsRender();
  }

  /**
   * Gets whether screen-space ambient occlusion (SSAO) is enabled.
   */
  get saoEnabled(): boolean {
    return this._saoEnabled;
  }

  /**
   * Sets whether screen-space ambient occlusion (SSAO) is enabled.
   * @param value Whether SSAO should be enabled.
   */
  set saoEnabled( value: boolean ) {
    this._saoEnabled = value;
    this.needsRender();
  }

  /**
   * Gets whether edge rendering is enabled.
   */
  get edgesEnabled(): boolean {
    return this._edgesEnabled;
  }

  /**
   * Sets whether edge rendering is enabled.
   * @param value Whether edge rendering should be enabled.
   */
  set edgesEnabled( value: boolean ) {
    this._edgesEnabled = value;
    this.needsRender();
  }

  /**
   * Gets whether transparency rendering is enabled.
   */
  get transparentEnabled(): boolean {
    return this._transparentEnabled;
  }

  /**
   * Sets whether transparency rendering is enabled.
   * @param value Whether transparency rendering should be enabled.
   */
  set transparentEnabled( value: boolean ) {
    this._transparentEnabled = value;
    this.needsRender();
  }

  /**
   * Gets whether physically-based rendering (PBR) is enabled.
   */
  get pbrEnabled(): boolean {
    return this._pbrEnabled;
  }

  /**
   * Sets whether physically-based rendering (PBR) is enabled.
   * @param value Whether PBR should be enabled.
   */
  set pbrEnabled( value: boolean ) {
    this._pbrEnabled = value;
    this.needsRender();
  }

  /**
   * Renders the view.
   *
   * @param params Optional rendering parameters.
   * @param params.force Whether to force rendering regardless of the current state.
   * @param params.opaqueOnly Whether to render only opaque objects.
   */
  render( params?: {force?: boolean; opaqueOnly?: boolean} ): void {
    const viewFlags = this._renderContext.viewFlags[this.view.viewIndex];
    if (!viewFlags) {
      console.warn("View flags not found for the current view index.");
      return;
    }
    const shouldRender = params?.force || viewFlags.needsRender;
   // if (shouldRender) {
      this.activate();
      this._renderManager.render(this, {clear: true});
   // }
    viewFlags.needsRender = false;
  }

  /**
   * Performs object picking in the view.
   *
   * @param params The picking parameters.
   * @param pickResult The result of the picking operation.
   * @returns Whether the picking operation was successful.
   */
  pick( params: PickParams, pickResult: PickResult ): boolean {
    this.activate();
    return this._pickManager.pick(this, params, pickResult);
  }

  /**
   * Clears the view.
   */
  clear() {
    this.activate();
    this.viewManager.clearView(this);
  }



  /**
   * Begins a snapshot operation for the view.
   *
   * @param params Optional snapshot parameters.
   * @param params.width The width of the snapshot.
   * @param params.height The height of the snapshot.
   */
  beginSnapshot( params?: {width: number; height: number} ) {
  }

  /**
   * Destroys the view, releasing all associated resources.
   */
  destroy() {
    this.renderBuffers?.destroy();
    this.renderBuffers = null;
    this._renderManager=null;
    this._pickManager=null;
  }
}