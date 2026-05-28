/**
 * Loads an SVG document as a `SceneModel` — strokes as line meshes,
 * fills as triangle meshes (via earcut), `<text>` rasterised to
 * textured quads. SVG parsing uses the browser's native
 * {@link DOMParser}; Node hosts must install a DOMParser polyfill
 * (e.g. `linkedom`, `xmldom`) onto `globalThis` before calling.
 *
 * This class is a thin façade — all parsing, walking, and SceneModel
 * emission lives in version-keyed parsers under `./versions/vN_0/`.
 * The constructor picks the parser; `load()` delegates verbatim.
 * Adding a future schema version is a new `versions/v2_0/parse.ts`
 * plus one constructor branch here — nothing else moves.
 *
 * The format coverage / supported entity types / opacity + dash
 * cascade rules are documented in detail at {@link parse} in
 * `./versions/v1_0/parse.ts`.
 */
import type {SDKResult} from "../../base/core";
import type {SceneModel} from "../../model/scene";

import type {SVGLoadOptions} from "./SVGLoadOptions";
import {parse as parse_v1_0} from "./versions/v1_0/parse";


/** Result returned by {@link SVGLoader.load} on success. */
export interface SVGLoadResult {
  /** SceneModel populated with one object per emitted group / element. */
  sceneModel: SceneModel;
  /** SVG viewBox in user-space units (post-{@link SVGLoadOptions.scale}). */
  viewBox: { x: number; y: number; width: number; height: number };
  /** Number of line segments emitted across all SceneObjects. */
  segmentCount: number;
  /** Number of fill triangles emitted across all SceneObjects. */
  triangleCount: number;
  /** Number of `<text>` elements rasterised as textured quads. */
  textCount: number;
  /** Ids of every SceneObject created by the load. */
  sceneObjectIds: string[];
}

/** Inputs handed to {@link SVGLoader.load}. */
export interface SVGLoadInput {
  /** SVG source as a UTF-8 string. The loader does not decode bytes. */
  fileData: string;
  /** Target SceneModel — must be unfinalised. */
  sceneModel: SceneModel;
}


export class SVGLoader {

  load(input: SVGLoadInput, options: SVGLoadOptions = {}): Promise<SDKResult<SVGLoadResult>> {
    return parse_v1_0(
      {fileData: input.fileData, sceneModel: input.sceneModel},
      options,
    );
  }
}
