import {EventEmitter, SDKErrorType} from "../core";
import {WebGLRenderer} from "./WebGLRenderer";

/**
 * Events for WebGLRenderer.
 */
export interface WebGLRendererEvents {

    /**
     * Emits an event when the `WebGLRenderer` itself is destroyed.
     */
    readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;

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