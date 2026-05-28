/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit AutoCAD DWG Loader
 *
 * Imports AutoCAD DWG documents as `SceneModel`s — strokes from
 * LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / ELLIPSE, fills from
 * 3DFACE, recursive INSERT block expansion, and TEXT / MTEXT
 * rasterised as textured quads.
 *
 * DWG parsing uses `@mlightcad/libredwg-web` (Emscripten port of
 * GNU libredwg) dynamically imported from a CDN on first call.
 * **Licence**: libredwg is GPL-3.0; apps shipping it (whether via
 * this loader's CDN default or a self-hosted copy) must honour
 * that licence.
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {DWGLoader} from "@xeokit/sdk/formats/dwg";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({id: "plan"}).value!;
 * const fileData = await fetch("/plan.dwg").then(r => r.arrayBuffer());
 *
 * const result = await new DWGLoader().load({fileData, sceneModel}, {
 *   scale: 1,
 *   circleSteps: 64,
 *   lineWidthScale: 4.0,
 *   objectIdStrategy: "layer",
 * });
 * ```
 *
 * See {@link DWGLoadOptions} for per-call tuning (scale, colour
 * overrides, circle tessellation, INSERT recursion limit, text
 * rasterisation knobs, libredwg CDN URLs).
 *
 * ## Self-hosting / Node usage
 *
 * Override the CDN URLs to self-host the WASM blob (CSP / offline
 * / version pinning):
 *
 * ```ts
 * await loader.load({fileData, sceneModel}, {
 *   libredwgEsmUrl:  "/static/libredwg-web/index.js",
 *   libredwgWasmDir: "/static/libredwg-web/wasm",
 * });
 * ```
 *
 * For Node, dynamic CDN imports don't work without polyfills —
 * pre-initialise libredwg and pass it through:
 *
 * ```ts
 * import {LibreDwg, Dwg_File_Type} from "@mlightcad/libredwg-web";
 * const lib = await LibreDwg.create();
 * await loader.load({fileData, sceneModel}, {
 *   libredwg: {lib, fileType: Dwg_File_Type},
 * });
 * ```
 *
 * @module dwg
 */
export * from "./lib";
export * from "./DWGLoader";
