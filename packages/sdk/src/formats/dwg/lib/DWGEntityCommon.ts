/**
 * Common fields shared by every variant of {@link DWGEntity}.
 *
 * The discriminated union members ({@link DWGLine}, {@link DWGArc},
 * etc.) extend this with their type-specific geometry fields and
 * tighten the `type` literal. The loader reads `layer` / `color` /
 * `lineWidth` from here when bucketing geometry into SceneObjects
 * and stroke meshes.
 *
 * @private
 */
export interface DWGEntityCommon {
  /** AutoCAD entity-type identifier. Case-insensitive on read. */
  type: string;
  /** Layer name; resolved against {@link DWGLayer} via the adapter or document's optional layers map. */
  layer?: string;
  /**
   * AutoCAD Color Index (`0` = ByBlock, `256` = ByLayer, `1..255`
   * = palette index). The loader resolves ByLayer / ByBlock at
   * emit time. A `[r, g, b]` triplet (channels in `[0, 1]`) bypasses
   * the ACI lookup and is used as-is — convenient for adapters
   * that pre-resolve colour.
   */
  color?: number | [number, number, number];
  /**
   * Stroke width in drawing units. Most DWG entities don't carry
   * a width; `undefined` falls back to the loader's
   * `DWGLoadOptions.defaultLineWidth`.
   */
  lineWidth?: number;
}
