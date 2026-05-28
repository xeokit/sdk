/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit PDF Drawing Loader
 *
 * Imports PDF documents as `SceneModel`s — strokes, filled regions,
 * image XObjects, and positioned text — suitable for displaying
 * plan / section sheets alongside (or instead of) the projected
 * drawings produced by the presentations/drawings system.
 *
 * PDF parsing uses `pdfjs-dist` dynamically imported from a CDN on
 * first call and cached. The CDN URLs are configurable via
 * {@link PDFLoadOptions.pdfjsEsmUrl} /
 * {@link PDFLoadOptions.pdfjsWorkerSrc} for self-hosting / CSP /
 * version pinning; a pre-initialised pdf.js namespace can be
 * injected via {@link PDFLoadOptions.pdfjs} (essential for Node).
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {PDFLoader} from "@xeokit/sdk/formats/pdf";
 *
 * const scene = new Scene();
 * const sceneModelRes = scene.createModel({
 *   id: "site-plan",
 *   coordinateSystem: {units: "millimeters"},
 * });
 * if (!sceneModelRes.ok) throw new Error(sceneModelRes.error);
 *
 * const fileData = await fetch("/plans/site.pdf").then(r => r.arrayBuffer());
 * const result = await new PDFLoader().load(
 *   {fileData, sceneModel: sceneModelRes.value},
 *   {scale: 25.4 / 72},   // PDF points → millimetres
 * );
 * if (result.ok === false) throw new Error(result.error);
 * ```
 *
 * ## Self-hosting
 *
 * ```ts
 * await loader.load({fileData, sceneModel}, {
 *   pdfjsEsmUrl:    "/static/pdfjs/pdf.min.mjs",
 *   pdfjsWorkerSrc: "/static/pdfjs/pdf.worker.min.mjs",
 * });
 * ```
 *
 * ## Node hosts
 *
 * Dynamic CDN imports don't work in Node without polyfills —
 * pre-initialise pdf.js and pass it through:
 *
 * ```ts
 * import * as pdfjsLib from "pdfjs-dist";
 * pdfjsLib.GlobalWorkerOptions.workerSrc = "...";
 * await loader.load({fileData, sceneModel}, {pdfjs: pdfjsLib});
 * ```
 *
 * See {@link PDFLoadOptions} for per-call tuning (scale, page list,
 * page gap, line colour, bezier tessellation, fills, text, images).
 *
 * @module pdf
 */
export * from "./PDFLoader";
export * from "./PDFLoadOptions";
