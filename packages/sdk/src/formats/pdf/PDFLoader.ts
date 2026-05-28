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
 * cached. CDN URLs are configurable via
 * {@link PDFLoadOptions.pdfjsEsmUrl} /
 * {@link PDFLoadOptions.pdfjsWorkerSrc} for self-hosting / CSP /
 * version pinning. Pre-initialised pdf.js namespaces can be
 * injected via {@link PDFLoadOptions.pdfjs} (essential for Node
 * hosts where dynamic CDN import doesn't work without polyfills).
 *
 * Format coverage, ops walked, bucketing rules, text-atlas
 * packing, image-XObject handling are documented at {@link parse}
 * in `./versions/v1_0/parse.ts`.
 */
import type {SDKResult} from "../../base/core";

import type {PDFLoadOptions} from "./PDFLoadOptions";
import {parse as parse_v1_0, type PDFLoadResult, type PDFLoadInput} from "./versions/v1_0/parse";


export type {PDFLoadResult, PDFLoadInput};


export class PDFLoader {

  load(input: PDFLoadInput, options: PDFLoadOptions = {}): Promise<SDKResult<PDFLoadResult>> {
    return parse_v1_0(input, options);
  }
}
