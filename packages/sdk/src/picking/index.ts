/**
 * # xeokit Picking
 *
 * Unified picking surface that routes between the CPU-side BVH picker
 * ({@link "../collision".SceneRaycaster}) and the GPU pick path on
 * {@link "../webGLRenderer".WebGLRenderer}, plus surfaces snap-to-vertex
 * and snap-to-edge as part of the same call.
 *
 * ## Why
 *
 * The two underlying paths each cover something the other can't:
 *
 *   - **BVH** — fast, no GPU stall, accepts ray and matrix inputs and
 *     custom `filter` callbacks. No snap support.
 *   - **GPU** — only canvas-pos pick, but does snap-to-vertex /
 *     snap-to-edge and produces world normals / UVs. Costs a
 *     `gl.readPixels` stall per call.
 *
 * Most callers want the cheap path most of the time and the snap
 * enrichment when they ask for it. The router here picks the right
 * backend per call, with snap requests degrading silently when the
 * GPU isn't available (no renderer attached, context lost, etc.).
 *
 * ## Usage
 *
 * ```ts
 * import { RoutingPickStrategy } from "@xeokit/sdk/picking";
 *
 * const picker = new RoutingPickStrategy(scene, renderer);
 *
 * // Cheap object pick — BVH:
 * const r1 = picker.pick({ view, canvasPos: [x, y] });
 *
 * // Snap-to-vertex pick — GPU when ready, BVH otherwise:
 * const r2 = picker.pick({
 *   view, canvasPos: [x, y],
 *   snapToVertex: true, snapRadius: 30,
 * });
 *
 * if (r2.snap) {
 *   // Snap landed — use r2.snap.worldPos
 * } else if (r2.hit) {
 *   // Surface hit only — use r2.worldPos
 * }
 * ```
 *
 * Construct with no `renderer` for a BVH-only picker; snap requests
 * silently degrade. The strategy also accepts a renderer that hasn't
 * been attached to a viewer yet — it subscribes to the renderer's
 * lifecycle events and flips its internal `gpuReady` flag once
 * `attachViewer` has run.
 *
 * @module picking
 */

export type {PickParams} from "./PickParams";
export type {PickResult, PickSnap, PickStrategyId} from "./PickResult";
export type {PickStrategy} from "./PickStrategy";

export {BVHPickStrategy} from "./BVHPickStrategy";
export {RendererPickStrategy} from "./RendererPickStrategy";
export {RoutingPickStrategy} from "./RoutingPickStrategy";
export {MemoisingPickStrategy} from "./MemoisingPickStrategy";
export type {MemoisingPickStrategyOptions} from "./MemoisingPickStrategy";
