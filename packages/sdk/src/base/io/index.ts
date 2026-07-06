/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit File I/O
 *
 * ---
 *
 * **File loading primitive used by SDK loaders.**
 *
 * ---
 *
 * The `io` module wraps the file fetch step behind a single
 * {@link FileIO | FileIO} interface. The shipped implementation is
 * {@link BrowserFileIO | BrowserFileIO}, which fetches over HTTP(S)
 * and returns a `Blob`.
 *
 * <br>
 *
 * ## Features
 *
 * - **One interface** — loaders code against {@link FileIO | FileIO}.
 * - **CrossPlatformBlob** — Blob-like with `arrayBuffer()`, `text()`,
 *   and `json()`.
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
export * from "./CrossPlatformBlob";
