/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit AutoCAD DXF Loader
 *
 * Imports AutoCAD DXF documents — the open ASCII (or binary)
 * sibling of DWG — as `SceneModel`s. Strokes from LINE /
 * LWPOLYLINE / CIRCLE / ARC, fills from 3DFACE, recursive INSERT
 * block expansion, TEXT / MTEXT rasterised as textured quads.
 *
 * DXF is open ASCII and the SDK parses it in-tree — no third-party
 * library or adapter to wire. The parser lives in
 * `./versions/v1_0/parse.ts`; {@link DXFLoader} is a thin façade.
 * Internally the parser builds a {@link DWGDocument} and hands it
 * to the shared DWG emission pipeline (so DXF and DWG share their
 * entire SceneModel-emit code path — only the parser differs).
 *
 * ## Usage
 *
 * ```ts
 * import {Scene} from "@xeokit/sdk/model/scene";
 * import {DXFLoader} from "@xeokit/sdk/formats/dxf";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({id: "plan"}).value!;
 *
 * const dxfText = await fetch("/plan.dxf").then(r => r.text());
 * await new DXFLoader().load({fileData: dxfText, sceneModel});
 * ```
 *
 * ## Exporting a SceneModel as DXF
 *
 * Pair-wise with the loader, {@link DXFExporter} writes a
 * SceneModel back out as ASCII DXF (AutoCAD R2000-compatible).
 * Triangle meshes become `3DFACE` entities, line meshes become
 * `LINE`s, point meshes become `POINT`s; one DXF LAYER per
 * SceneObject. Per-mesh colour round-trips via DXF's true-colour
 * group code 420.
 *
 * ```ts
 * import {DXFExporter} from "@xeokit/sdk/formats/dxf";
 *
 * const dxfText = await new DXFExporter().write({sceneModel});
 * ```
 *
 * @module dxf
 */
export * from "./DXFLoader";
export * from "./DXFExporter";
// DXF reuses DWG's options shape verbatim — re-exported here under
// the DXF name so callers can write `DXFLoadOptions` without
// reaching across format namespaces.
export type {DWGLoadOptions as DXFLoadOptions} from "../dwg/lib/DWGLoadOptions";
