import {EventEmitter, SDKErrorType} from "../core";
import {WebGLRenderer} from "./WebGLRenderer";
import {View, Viewer} from "../viewer";

/**
 * Events for WebGLRenderer.
 */
export interface WebGLRendererEvents {

  /**
   * Emits an event when the `WebGLRenderer` is attached to a `Viewer`.
   */
  readonly onViewerAttached: EventEmitter<WebGLRenderer, Viewer>;

  /**
   * Emits an event when the `WebGLRenderer` is detached from a `Viewer`.
   */
  readonly onViewerDetached: EventEmitter<WebGLRenderer, Viewer>;

  /**
   * Emits an event when the `WebGLRenderer` is started.
   */
  readonly onRendererStarted: EventEmitter<WebGLRenderer, void>;

  /**
   * Emits an event when the `WebGLRenderer` has rendered a new frame for a `View` belonging to the attached `Viewer`.
   */
  readonly onViewRendered: EventEmitter<WebGLRenderer, View>;

  /**
   * Emits an event when the `WebGLRenderer` is stopped.
   */
  readonly onRendererStopped: EventEmitter<WebGLRenderer, void>;

  /**
   * Emits an event when the `WebGLRenderer` itself is destroyed.
   */
  readonly onRendererDestroyed: EventEmitter<WebGLRenderer, boolean>;

  /**
   * Emits an event when the WebGL context is lost.
   *
   * At this point, the `WebGLRenderer` is not functional until the context is restored.
   */
  readonly webglContextLost: EventEmitter<WebGLRenderer, Event>,

  /**
   * Emits an event when the WebGL context is restored.
   *
   * At this point, the `WebGLRenderer` should have automatically recovered and resumed rendering.
   */
  readonly webglContextRestored: EventEmitter<WebGLRenderer, void>,

  /**
   * Emits an event when an error occurs within the `WebGLRenderer`.
   */
  readonly onError: EventEmitter<WebGLRenderer, { ok: false, type: SDKErrorType, error: string }>;
}
