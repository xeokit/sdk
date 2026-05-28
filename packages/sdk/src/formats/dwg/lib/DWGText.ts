import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `TEXT` — a single-line label. When
 * {@link DWGLoadOptions.renderText} is true (the default) the
 * loader rasterises the string into a canvas at
 * {@link DWGLoadOptions.textPxPerUnit} resolution and emits a
 * textured quad at `position`, sized by `height` (cap height in
 * drawing units) and rotated around +Z.
 *
 * Browser-only — Node hosts without a `<canvas>` should pass
 * `renderText: false` and rasterise externally if needed.
 *
 * @private
 */
export interface DWGText extends DWGEntityCommon {
  type: "TEXT";
  text:     string;
  /** Baseline-left position. */
  position: Vec3;
  /** Cap height in drawing units. */
  height:   number;
  /** Rotation around +Z in radians. */
  rotation?: number;
}
