import type {EventEmitter} from "../../../base/core";
import type {View, Viewer} from "../../viewer";
import type {RendererError} from "./RendererError";

/**
 * Renderer lifecycle and diagnostic events shared by renderer backends.
 *
 * Backend-specific renderers may expose additional aliases or events, but
 * higher-level viewer, Studio, and picking code should depend on this surface.
 *
 * @typeParam TRenderer - Concrete renderer implementation that emits the
 * events.
 */
export interface RendererEvents<TRenderer = unknown> {

  /** Emits after a Viewer has been attached to the renderer. */
  readonly onViewerAttached: EventEmitter<TRenderer, Viewer>;

  /** Emits after the currently attached Viewer has been detached. */
  readonly onViewerDetached: EventEmitter<TRenderer, Viewer>;

  /** Emits when rendering starts. */
  readonly onRendererStarted: EventEmitter<TRenderer, void>;

  /** Emits after the renderer has rendered a frame for a View. */
  readonly onViewRendered: EventEmitter<TRenderer, View>;

  /** Emits when rendering stops. */
  readonly onRendererStopped: EventEmitter<TRenderer, void>;

  /** Emits when the renderer is destroyed. */
  readonly onRendererDestroyed: EventEmitter<TRenderer, boolean>;

  /** Emits when the renderer's graphics device or context becomes unavailable. */
  readonly onContextLost: EventEmitter<TRenderer, Event>;

  /** Emits when the renderer has recovered from a context/device loss. */
  readonly onContextRestored: EventEmitter<TRenderer, void>;

  /** Emits renderer errors through the SDK result shape. */
  readonly onError: EventEmitter<TRenderer, RendererError>;
}
