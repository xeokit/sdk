/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit File I/O
 *
 * ---
 *
 * **File loading primitive shared by every SDK loader.**
 *
 * ---
 *
 * The `io` module abstracts the "go fetch a file" step so loader
 * code calls a single {@link FileIO | FileIO} interface and stays
 * portable. The shipped implementation is
 * {@link BrowserFileIO | BrowserFileIO}, which fetches over
 * HTTP(S) and returns a `Blob`. A Node implementation hasn't been
 * ported yet.
 *
 * <br>
 *
 * ## Features
 *
 * - **One interface** — {@link FileIO | FileIO} is the contract
 *   every loader codes against. Hosts that need a different
 *   transport (a CDN sidecar, an in-memory test fixture) supply
 *   their own implementation.
 * - **CrossPlatformBlob** — uniform Blob-like with
 *   `arrayBuffer()` / `text()` / `json()`.
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
