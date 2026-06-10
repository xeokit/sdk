/**
 * <img style="padding:10px" src="../../assets/dwg_hero.jpg"/>
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
 * rasterisation knobs). The libredwg CDN URLs are configured once on
 * the constructor — see {@link DWGLoaderParams}.
 *
 * ## Self-hosting / Node usage
 *
 * Configure the CDN URLs on the constructor to self-host the WASM blob
 * (CSP / offline / version pinning):
 *
 * ```ts
 * const loader = new DWGLoader({
 *   libredwgEsmUrl:  "/static/libredwg-web/index.js",
 *   libredwgWasmDir: "/static/libredwg-web/wasm",
 * });
 * await loader.load({fileData, sceneModel});
 * ```
 *
 * For Node, dynamic CDN imports don't work without polyfills —
 * pre-initialise libredwg and inject it on the constructor:
 *
 * ```ts
 * import {LibreDwg, Dwg_File_Type} from "@mlightcad/libredwg-web";
 * const lib = await LibreDwg.create();
 * const loader = new DWGLoader({
 *   libredwg: {lib, fileType: Dwg_File_Type},
 * });
 * await loader.load({fileData, sceneModel});
 * ```
 *
 * @module dwg
 */
export * from "./lib";
export * from "./DWGLoader";
