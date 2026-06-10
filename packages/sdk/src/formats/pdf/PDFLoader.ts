/**
 * Loads a PDF document as a `SceneModel` — vector strokes, fills,
 * embedded images, and positioned text (rasterised through a
 * per-page texture atlas). One SceneObject per page, laid out per
 * {@link PDFLoadOptions.layout}.
 *
 * Thin façade — all pdf.js wiring, operator-list walking, image /
 * text emission, and SceneModel calls live in version-keyed parsers
 * under `./versions/vN_0/parse.ts`. The constructor picks the
 * parser; `load()` delegates verbatim. Adding a future schema
 * variant is a new `versions/v2_0/parse.ts` plus one constructor
 * branch here — nothing else moves.
 *
 * pdf.js is dynamically imported from a CDN on first load and
 * cached. CDN URLs are configured on the constructor via
 * {@link PDFLoaderParams.pdfjsEsmUrl} /
 * {@link PDFLoaderParams.pdfjsWorkerSrc} for self-hosting / CSP /
 * version pinning. A pre-initialised pdf.js namespace can instead be
 * injected on the constructor via {@link PDFLoaderParams.pdfjs}
 * (essential for Node hosts where dynamic CDN import doesn't work
 * without polyfills).
 *
 * Format coverage, ops walked, bucketing rules, text-atlas
 * packing, image-XObject handling are documented at {@link parse}
 * in `./versions/v1_0/parse.ts`.
 */
import type {SDKResult} from "../../base/core";

import type {PDFLoadOptions, PDFLoaderParams} from "./PDFLoadOptions";
import {parse as parse_v1_0, type PDFLoadResult, type PDFLoadInput} from "./versions/v1_0/parse";


export type {PDFLoadResult, PDFLoadInput};


export class PDFLoader {

  readonly #pdfjsEsmUrl?: string;
  readonly #pdfjsWorkerSrc?: string;
  readonly #pdfjs?: any;

  /**
   * @param params How to obtain the pdf.js parser. Omit to fetch from
   * the jsdelivr defaults; override the CDN URLs to self-host (CSP /
   * offline / version pinning), or inject a pre-initialised namespace
   * via `pdfjs` (e.g. for Node). See {@link PDFLoaderParams}.
   */
  constructor(params: PDFLoaderParams = {}) {
    this.#pdfjsEsmUrl   = params.pdfjsEsmUrl;
    this.#pdfjsWorkerSrc = params.pdfjsWorkerSrc;
    this.#pdfjs         = params.pdfjs;
  }

  load(input: PDFLoadInput, options: PDFLoadOptions = {}): Promise<SDKResult<PDFLoadResult>> {
    return parse_v1_0(input, {
      ...options,
      pdfjsEsmUrl:    this.#pdfjsEsmUrl,
      pdfjsWorkerSrc: this.#pdfjsWorkerSrc,
      pdfjs:          this.#pdfjs,
    });
  }
}
