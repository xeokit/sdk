import type {DWGBlock} from "./DWGBlock";
import type {DWGEntity} from "./DWGEntity";
import type {DWGHeader} from "./DWGHeader";


/**
 * Parsed DWG document, in the minimal shape the loader walks.
 *
 * Shared between {@link DWGLoader} (parses from DWG bytes) and
 * {@link DXFLoader} (parses from DXF text) — both build a
 * `DWGDocument` internally before the shared SceneModel emission
 * step. Also the input shape for the `emit` entry point in
 * `versions/v1_0/parse.ts`; callers that want to skip the built-in
 * libredwg parser entirely can build a `DWGDocument` by hand (e.g.
 * from a server-side conversion result) and feed it to `emit()`
 * directly.
 *
 * - `entities` — flat list of model-space (and paper-space, if the
 *   adapter merges them) entities.
 * - `blocks` — named block definitions referenced by `INSERT`
 *   entities; the loader expands each `INSERT` by recursively
 *   walking its block's entities under a position/scale/rotation.
 * - `header` — optional document-level metadata.
 *
 * @private
 */
export interface DWGDocument {
  header?: DWGHeader;
  blocks?: DWGBlock[];
  entities: DWGEntity[];
}
