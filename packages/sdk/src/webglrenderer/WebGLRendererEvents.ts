import {EventEmitter, SDKErrorType} from "../core";
import {WebGLRenderer} from "./WebGLRenderer";
import {Viewer} from "../viewer";

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
     * Emits an event when the `WebGLRenderer` itself is destroyed.
     */
    readonly onRendererDestroyed: EventEmitter<WebGLRenderer, boolean>;

    /**
     * Emits an event when the WebGL context is lost.
     */
    readonly webglContextLost: EventEmitter<WebGLRenderer, WebGLContextEvent>,

    /**
     * Emits an event when an error occurs within the `WebGLRenderer`.
     */
    readonly onError: EventEmitter<WebGLRenderer, {
        ok: false,
        type: SDKErrorType,
        error: string
    }>;
}