import type {Capabilities} from "../core";
import {EventEmitter, SDKError} from "../core";
import type {Renderer, Viewer} from "../viewer";
import {EventDispatcher} from "strongly-typed-events";
import {RenderContext} from "./RenderContext";
import {ViewManager} from "./viewManager/ViewManager";

/**
 * WebGL rendering strategy for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export class WebGLRenderer implements Renderer {

  private _renderContext: RenderContext|null = null;
  private _viewManager!: ViewManager;
  private _destroyed = false;

  /** @internal */
  readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;

  private _unsubscribeViewerDestroyed: (() => void)|null = null;

  /**
   * Constructs a new WebGLRenderer.
   */
  constructor() {
    this.onDestroyed = new EventEmitter(new EventDispatcher<WebGLRenderer, boolean>());
  }

  /**
   * Gets the capabilities of this WebGLRenderer.
   */
  public getCapabilities( capabilities: Capabilities ): void {
    RenderContext.getCapabilities(capabilities);
  }

  /**
   * Initializes this WebGLRenderer by attaching a Viewer.
   * @internal
   */
  public attachViewer( viewer: Viewer ): void {
    if (this._renderContext) {
      throw new SDKError("Can't attach Viewer - a Viewer is already attached");
    }
    if ((viewer as any).renderer) {
      throw new SDKError("Can't attach Viewer - given Viewer is already attached to another Renderer");
    }
    this._unsubscribeViewerDestroyed = viewer.onDestroyed.subscribe(( _viewer, _args ) => {
      this.detachViewer();
    });
    this._renderContext = new RenderContext(viewer);
    this._viewManager = new ViewManager(this._renderContext);
  }

  /** The Viewer this WebGLRenderer is currently attached to, if any. */
  public get viewer(): Viewer|null {
    return this._renderContext ? this._renderContext.viewer : null;
  }

  /**
   * Detaches the Viewer that is currently attached, if any.
   * @internal
   */
  public detachViewer(): void {
    if (!this._renderContext) {
      return;
    }
    this._unsubscribeViewerDestroyed?.();
    this._unsubscribeViewerDestroyed = null;
    this._viewManager?.destroy();
    this._viewManager = undefined as unknown as ViewManager;
    this._renderContext?.destroy();
    this._renderContext = null;
  }

  /**
   * Destroys this WebGLRenderer.
   */
  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    this.detachViewer();
    this._destroyed = true;
    this.onDestroyed.dispatch(this, true);
  }
}
