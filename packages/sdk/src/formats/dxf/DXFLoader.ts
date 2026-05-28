/**
 * Loads an AutoCAD DXF document as a `SceneModel`.
 *
 * Thin façade — all parsing, entity mapping, and SceneModel
 * emission lives in version-keyed parsers under
 * `./versions/vN_0/parse.ts`. The constructor picks the parser;
 * `load()` delegates verbatim. Adding a future schema variant is a
 * new `versions/v2_0/parse.ts` plus one constructor branch here —
 * nothing else moves.
 *
 * DXF is open ASCII and the format is simple enough for the SDK
 * to parse in-tree without bundling a third-party library; the
 * v1.0 parser handles the common AECO entity set (LINE,
 * LWPOLYLINE, CIRCLE, ARC, 3DFACE, INSERT, TEXT, MTEXT, plus the
 * BLOCKS section for INSERT recursion).
 *
 * Format coverage, INSERT recursion, ACI colour resolution, text
 * rasterisation rules are all documented at {@link parse} in
 * `./versions/v1_0/parse.ts` (parser specifics) and in
 * `dwg/versions/v1_0/parse.ts` (emit specifics — DXF and DWG
 * share the entire emission pipeline; only the parser differs).
 */
import type {SDKResult} from "../../base/core";
import type {SceneModel} from "../../model/scene";

import type {DWGLoadOptions} from "../dwg/lib/DWGLoadOptions";
import type {DWGLoadResult} from "../dwg/lib/DWGLoadResult";

import {parse as parse_v1_0} from "./versions/v1_0/parse";


export type DXFLoadResult = DWGLoadResult;

/** Inputs handed to {@link DXFLoader.load}. */
export interface DXFLoadInput {
  /** DXF source as a UTF-8 string. */
  fileData:   string;
  /** Target SceneModel — must be unfinalised. */
  sceneModel: SceneModel;
}


export class DXFLoader {

  load(input: DXFLoadInput, options: DWGLoadOptions = {}): Promise<SDKResult<DXFLoadResult>> {
    return parse_v1_0(
      {fileData: input.fileData, sceneModel: input.sceneModel},
      options,
    );
  }
}
