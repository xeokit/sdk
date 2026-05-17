/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit WebGL2 Utilities
 *
 * ---
 *
 * **Lightweight WebGL2 wrappers and helpers — array buffers,
 * attributes, programs, textures, render / pick / snap buffers,
 * extension lookups, plus a canvas-to-image snapshot helper.**
 *
 * ---
 *
 * `webGL` is the raw WebGL2 plumbing layer. It has no dependency on
 * the {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}
 * and is safe to use standalone for hosts that want to compose
 * their own GL pipelines while sharing the SDK's typed wrappers and
 * constant-mapping conventions.
 *
 * <br>
 *
 * ## Features
 *
 * - **Typed wrappers** — programs, shaders, array buffers,
 *   attributes, samplers, textures, render / pick / snap buffers,
 *   each as a small class with `bind` / `destroy` lifecycle.
 * - **Extension lookup** — {@link getWebGLExtension} short-circuits
 *   the repeated `gl.getExtension(...)` pattern with caching +
 *   warn-once-missing.
 * - **WEBGL_INFO** — runtime lookup of supported extensions, GL
 *   limits, and capability constants, populated lazily on first
 *   access.
 * - **xeokit ↔ GL constant mapping** —
 *   {@link convertWebGLConstant} resolves xeokit-side enum codes
 *   (LinearEncoding, ClampToEdgeWrapping, …) to the raw `GLenum`
 *   the GL API wants.
 * - **Canvas snapshot** — {@link Canvas2Image} writes the active
 *   canvas to PNG / JPEG / BMP files; supports vertical-flip mode
 *   for snapshots from WebGL frame buffers.
 * - **WebGLContextProvider** — interface other modules implement
 *   to surface their `WebGL2RenderingContext` without each consumer
 *   reaching into renderer internals.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * @module webGL
 */

export * from "./WebGLContextProvider";
export * from "./WebGLArrayBuf";
export * from "./WebGLAttribute";
export * from "./WebGLProgram";
export * from "./WebGLRenderBuffer";
export * from "./WebGLPickBuffer";
export * from "./WebGLSnapBuffer";
export * from "./WebGLSampler";
export * from "./WebGLShader";
export * from "./WebGLAbstractTexture";
export * from "./WebGLTexture";
export * from "./getWebGLExtension";
export * from "./canvas2image";
export * from "./convertWebGLConstant";
export * from "./WEBGL_INFO";
