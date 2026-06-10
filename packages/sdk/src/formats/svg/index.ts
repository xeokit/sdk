/**
 * <img style="padding:10px" src="../../assets/svg_icon.png"/>
 *
 * # xeokit SVG Drawing Loader
 *
 * Imports SVG documents as `SceneModel`s — strokes as line meshes,
 * fills as triangle meshes (via earcut), `<text>` rasterised to
 * textured quads. Suitable for displaying 2D drawings, logos,
 * AECO-export plans, and other vector graphics inside a 3D scene.
 *
 * SVG parsing uses the browser's native {@link DOMParser}. Node
 * hosts must install a DOMParser polyfill (e.g. `linkedom`,
 * `xmldom`) onto `globalThis` before calling.
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {SVGLoader} from "@xeokit/sdk/formats/svg";
 *
 * const scene = new Scene();
 * const sceneModelRes = scene.createModel({id: "logo"});
 * if (!sceneModelRes.ok) throw new Error(sceneModelRes.error);
 *
 * const svgText = await fetch("/logo.svg").then(r => r.text());
 * const result  = await new SVGLoader().load(
 *   {fileData: svgText, sceneModel: sceneModelRes.value},
 *   {scale: 1, bezierSteps: 24, renderFills: true},
 * );
 * ```
 *
 * See {@link SVGLoadOptions} for per-call tuning (scale, Y-flip,
 * stroke / fill colour overrides, bezier / circle tessellation,
 * fills toggle).
 *
 * ## Exporting a SceneModel as SVG
 *
 * Pair-wise with the loader, {@link SVGExporter} writes a
 * SceneModel back out as SVG text. Triangle meshes become
 * `<polygon>`, line meshes become `<line>` (or coalesced
 * `<polyline>`), point meshes become `<circle r="...">`. One
 * `<g id="...">` wrapper per SceneObject. SVG is inherently 2D so
 * one world axis is dropped — see
 * {@link SVGExportOptions.projectionPlane}.
 *
 * ```ts
 * import {SVGExporter} from "@xeokit/sdk/formats/svg";
 *
 * const svgText = await new SVGExporter().write({sceneModel}, {
 *   projectionPlane: "XY",
 *   flipY: true,
 *   backgroundColor: [1, 1, 1],
 * });
 * ```
 *
 * @module svg
 */
export * from "./SVGLoader";
export * from "./SVGLoadOptions";
export * from "./SVGExporter";
export * from "./SVGExportOptions";
