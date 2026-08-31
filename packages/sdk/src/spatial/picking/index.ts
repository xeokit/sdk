/**
 * # xeokit Picking
 *
 * ---
 *
 * **Unified picking surface that routes between the CPU-side BVH
 * picker and the GPU pick path, surfacing snap-to-vertex and
 * snap-to-edge as part of the same call.**
 *
 * ---
 *
 * Picking is two distinct problems wearing one hat. The
 * BVH picker is fast, ray- or matrix-driven, and supports caller
 * `filter` callbacks but cannot snap. The GPU picker only accepts a
 * canvas position but produces world normals, UVs, and snap targets
 * via a `gl.readPixels` stall. Most callers want the cheap path most
 * of the time and the snap enrichment when they ask for it.
 *
 * The `picking` module wraps both behind a single
 * {@link PickStrategy} interface, with {@link RoutingPickStrategy}
 * choosing the right backend per call. Snap requests degrade
 * silently to BVH when the GPU isn't available (no renderer
 * attached, context lost, etc.).
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class PickStrategy {
 *       <<interface>>
 *       +pick(params) PickResult
 *     }
 *     class BVHPickStrategy {
 *       +pick(params) PickResult
 *     }
 *     class RendererPickStrategy {
 *       +pick(params) PickResult
 *     }
 *     class RoutingPickStrategy {
 *       +pick(params) PickResult
 *     }
 *     class MemoisingPickStrategy {
 *       +pick(params) PickResult
 *     }
 *     class PickParams {
 *       +view           : View
 *       +canvasPos?     : Vec2
 *       +origin? / dir? : Vec3
 *       +matrix?        : Mat4
 *       +snapToVertex?  : boolean
 *       +snapToEdge?    : boolean
 *       +snapRadius?    : number
 *       +filter?        : (obj) =&gt; boolean
 *     }
 *     class PickResult {
 *       +hit       : boolean
 *       +viewObject? : ViewObject
 *       +worldPos? / worldNormal? / uv?
 *       +snap?       : PickSnap
 *     }
 *     class SceneCollisionIndex {
 *       <<collision>>
 *     }
 *     class WebGLRenderer {
 *       <<viewing>>
 *     }
 *     PickStrategy <|.. BVHPickStrategy
 *     PickStrategy <|.. RendererPickStrategy
 *     PickStrategy <|.. RoutingPickStrategy
 *     PickStrategy <|.. MemoisingPickStrategy
 *     BVHPickStrategy o-- SceneCollisionIndex : queries
 *     RendererPickStrategy o-- WebGLRenderer : queries
 *     RoutingPickStrategy o-- BVHPickStrategy : routes
 *     RoutingPickStrategy o-- RendererPickStrategy : routes
 *     MemoisingPickStrategy o-- PickStrategy : wraps
 *     PickStrategy ..> PickParams : reads
 *     PickStrategy ..> PickResult : returns
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Common interface** — every picker implements {@link PickStrategy}
 *   so callers don't branch on backend. Same `pick(params)` call;
 *   strategies decide what to do with `canvasPos` / `origin+dir` /
 *   `matrix` inputs.
 * - **{@link BVHPickStrategy}** — CPU-side, drives the
 *   {@link collision!SceneCollisionIndex | SceneCollisionIndex}.
 *   Accepts ray, matrix, or `canvasPos` (turned into a ray via the
 *   View's camera). No GPU stall; no snap.
 * - **{@link RendererPickStrategy}** — GPU-side, drives the
 *   renderer's pick path, including WebGLRenderer and WebGPURenderer.
 *   Only `canvasPos` input; returns renderer-specific surface details
 *   and snap targets when the backend supplies them.
 * - **{@link RoutingPickStrategy}** — composes the two. Without snap,
 *   routes to BVH (cheap); with snap requested, routes to GPU when
 *   ready and falls back to BVH (without snap) otherwise.
 * - **{@link MemoisingPickStrategy}** — wraps any strategy with a
 *   per-`canvasPos` cache so a hover handler that picks every
 *   pointer-move event doesn't repeat identical queries inside one
 *   frame.
 * - **Snap-aware** — `snapToVertex` / `snapToEdge` + `snapRadius`
 *   ride along on every `pick()` call. Strategies that don't
 *   support snap drop the request and return a plain hit.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   BVHPickStrategy,
 *   RendererPickStrategy,
 *   RoutingPickStrategy
 * } from "@xeokit/sdk/spatial/picking";
 * ```
 *
 * <br>
 *
 * ### 2) Construct a routing picker
 *
 * Pass the {@link model!scene.Scene | Scene} and the (optional)
 * {@link viewing!renderers.webGL.WebGLRenderer | WebGLRenderer}. Without
 * a renderer the strategy is BVH-only; snap requests degrade silently.
 *
 * ```javascript
 * const picker = new RoutingPickStrategy(scene, renderer);
 * ```
 *
 * <br>
 *
 * ### 3) Cheap object pick (BVH path)
 *
 * ```javascript
 * const r = picker.pick({ view, canvasPos: [x, y] });
 * if (r.hit) {
 *   console.log("hit", r.objectId, "at", r.worldPos);
 * }
 * ```
 *
 * <br>
 *
 * ### 4) Snap-to-vertex / snap-to-edge (GPU when ready, BVH otherwise)
 *
 * ```javascript
 * const r = picker.pick({
 *   view, canvasPos: [x, y],
 *   snapToVertex: true,
 *   snapRadius:   30
 * });
 *
 * if (r.snap) {
 *   // Snap landed — use r.snap.worldPos
 * } else if (r.hit) {
 *   // Plain surface hit
 * }
 * ```
 *
 * <br>
 *
 * ### 5) Memoise to avoid repeat queries in a hover handler
 *
 * ```javascript
 * import { MemoisingPickStrategy } from "@xeokit/sdk/spatial/picking";
 *
 * const cached = new MemoisingPickStrategy(picker, {
 *   maxAgeMs: 16              // expire within one frame
 * });
 *
 * canvas.addEventListener("pointermove", (e) => {
 *   const r = cached.pick({ view, canvasPos: [e.offsetX, e.offsetY] });
 *   // ...
 * });
 * ```
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
