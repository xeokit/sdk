import type {RendererEvents} from "../../renderer";
import type {WebGPURenderer} from "./WebGPURenderer";

/**
 * Lifecycle, device, render, and error events emitted by {@link WebGPURenderer}.
 *
 * The event names mirror the backend-neutral renderer contract so viewer and
 * Studio integrations can consume WebGPU and WebGL through the same public
 * event surface.
 */
export interface WebGPURendererEvents extends RendererEvents<WebGPURenderer> {
}
