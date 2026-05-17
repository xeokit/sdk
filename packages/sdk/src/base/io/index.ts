/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit File I/O
 *
 * ---
 *
 * **Cross-platform file loading primitives shared by every SDK
 * loader — works the same in browsers (fetch / Blob) and in Node
 * (filesystem).**
 *
 * ---
 *
 * The `io` module abstracts the "go fetch a file" step so loader
 * code is identical whether it runs in a browser or inside a Node
 * CLI / converter. Pick one of the platform-specific implementations
 * ({@link BrowserFileIO} / {@link NodeFileIO}) for the runtime
 * environment, then pass the loader-agnostic
 * {@link FileIO | FileIO} surface to any
 * {@link formats!ModelLoader | ModelLoader}.
 *
 * <br>
 *
 * ## Features
 *
 * - **One interface, two impls** — {@link FileIO | FileIO} is the
 *   contract every loader codes against; pick
 *   {@link BrowserFileIO | BrowserFileIO} or
 *   {@link NodeFileIO | NodeFileIO} at the host boundary and
 *   loaders stay portable.
 * - **CrossPlatformBlob** — uniform Blob-like with
 *   `arrayBuffer()` / `text()` / `json()` works whether the
 *   underlying payload came from `fetch` or `fs.readFile`.
 * - **LoadingManager events** — `onStart` / `onProgress` /
 *   `onLoad` / `onError` drive progress UI without each loader
 *   reinventing event plumbing.
 * - **Cache** — opt-in URL → ArrayBuffer cache shared by every
 *   {@link FileLoader | FileLoader}; useful for repeated chunk
 *   fetches inside a single load.
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
 * ```javascript
 * import { BrowserFileIO } from "@xeokit/sdk/base/io";
 *
 * const io = new BrowserFileIO();
 * const buffer = await io.load("./model.xgf");
 * // pass `buffer` to an XGFLoader.load(...)
 * ```
 *
 * @module io
 */

export * from "./FileIO";
export * from "./BrowserFileIO";
export * from "./NodeFileIO";
export * from "./CrossPlatformBlob";
export * from "./Loader";
export * from "./LoadingManager";
export * from "./Cache";
export * from "./FileLoader";
