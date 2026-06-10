/**
 * Loads an AutoCAD DWG document as a `SceneModel`.
 *
 * Thin façade — all parsing, libredwg WASM loading, entity mapping,
 * and SceneModel emission lives in version-keyed parsers under
 * `./versions/vN_0/parse.ts`. The constructor picks the parser;
 * `load()` delegates verbatim. Adding a future schema variant is a
 * new `versions/v2_0/parse.ts` plus one constructor branch here —
 * nothing else moves.
 *
 * The DWG parser ({@link https://github.com/mlightcad/libredwg-web | @mlightcad/libredwg-web})
 * is dynamically imported from a CDN on first load and cached. CDN
 * URLs are configured on the constructor via
 * {@link DWGLoaderParams.libredwgEsmUrl} /
 * {@link DWGLoaderParams.libredwgWasmDir} for self-hosting / CSP /
 * version pinning. A pre-initialised parser instance can instead be
 * injected on the constructor via {@link DWGLoaderParams.libredwg}
 * (essential for Node hosts where dynamic CDN import doesn't work
 * without polyfills).
 *
 * Format coverage, INSERT recursion, ACI colour resolution, text
 * rasterisation rules are all documented at {@link parse} in
 * `./versions/v1_0/parse.ts`.
 *
 * Licence note: libredwg-web is GPL-3.0. Apps that ship the parser
 * (whether via this loader's CDN default or self-hosted) must
 * honour that licence.
 */
import type {SDKResult} from "../../base/core";
import type {SceneModel} from "../../model/scene";

import type {DWGLoadOptions, DWGLoaderParams} from "./lib/DWGLoadOptions";
import type {DWGLoadResult} from "./lib/DWGLoadResult";
import {parse as parse_v1_0} from "./versions/v1_0/parse";

/** Inputs handed to {@link DWGLoader.load}. */
export interface DWGLoadInput {
  /** DWG byte stream (typically from `fetch(...).then(r => r.arrayBuffer())`). */
  fileData:   ArrayBuffer | Uint8Array<any>;
  /** Target SceneModel — must be unfinalised. */
  sceneModel: SceneModel;
}


export class DWGLoader {

  readonly #libredwgEsmUrl?: string;
  readonly #libredwgWasmDir?: string;
  readonly #libredwg?: {lib: any; fileType: any};

  /**
   * @param params How to obtain the libredwg-web parser. Omit to fetch
   * from the jsdelivr defaults; override the CDN URLs to self-host (CSP /
   * offline / version pinning), or inject a pre-initialised instance via
   * `libredwg` (e.g. for Node). See {@link DWGLoaderParams}.
   */
  constructor(params: DWGLoaderParams = {}) {
    this.#libredwgEsmUrl  = params.libredwgEsmUrl;
    this.#libredwgWasmDir = params.libredwgWasmDir;
    this.#libredwg        = params.libredwg;
  }

  load(input: DWGLoadInput, options: DWGLoadOptions = {}): Promise<SDKResult<DWGLoadResult>> {
    return parse_v1_0(
      {fileData: input.fileData, sceneModel: input.sceneModel},
      {
        ...options,
        libredwgEsmUrl:  this.#libredwgEsmUrl,
        libredwgWasmDir: this.#libredwgWasmDir,
        libredwg:        this.#libredwg,
      },
    );
  }
}
