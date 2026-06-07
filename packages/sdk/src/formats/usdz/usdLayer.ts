/**
 * Classifies a USD layer by its leading magic bytes.
 *
 * A USDZ package's root layer is one of two on-disk encodings, and they
 * need completely different readers:
 *
 *  - **`"crate"`** — binary USD Crate, begins with `"PXR-USDC"`. This is
 *    what ARKit / Blender / Sketchfab exports produce.
 *  - **`"ascii"`** — text USDA, begins with `"#usda"`.
 *
 * Content is authoritative; the filename extension is only a hint (a
 * `.usd` file may be either encoding).
 *
 * @internal
 */
export type USDLayerKind = "crate" | "ascii" | "unknown";

const CRATE_MAGIC = "PXR-USDC";
const ASCII_MAGIC = "#usda";

/** Detects whether a USD layer's bytes are binary Crate or ASCII USDA. */
export function detectUSDLayer(data: Uint8Array<any>): USDLayerKind {
  if (startsWithAscii(data, CRATE_MAGIC)) {
    return "crate";
  }
  if (startsWithAscii(data, ASCII_MAGIC)) {
    return "ascii";
  }
  return "unknown";
}

function startsWithAscii(data: Uint8Array<any>, magic: string): boolean {
  if (data.length < magic.length) {
    return false;
  }
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}
