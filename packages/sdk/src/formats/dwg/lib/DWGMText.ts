import type {DWGEntityCommon} from "./DWGEntityCommon";
import type {Vec3} from "./Vec3";


/**
 * AutoCAD `MTEXT` — the multi-line ("paragraph") sibling of
 * {@link DWGText}. `width` (when supplied) is the wrap width in
 * drawing units; lines wrap at that width and stack downward from
 * `position`. Rasterisation behaviour and the
 * {@link DWGLoadOptions.renderText} switch match `DWGText` — the
 * loader uses the same canvas pipeline for both.
 *
 * Complex MTEXT formatting codes (`\C`, `\f`, `\H`, stacked
 * fractions, paragraph alignment overrides) aren't interpreted —
 * they appear in the rasterised string verbatim. Hosts that need
 * faithful MTEXT formatting should pre-process the source.
 *
 * @private
 */
export interface DWGMText extends DWGEntityCommon {
  type: "MTEXT";
  text:     string;
  position: Vec3;
  height:   number;
  /** Text-block width in drawing units (multi-line wrap). Optional. */
  width?:   number;
  rotation?: number;
}
