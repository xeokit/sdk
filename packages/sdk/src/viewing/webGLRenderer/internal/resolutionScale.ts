import type {View} from "../../viewer";

/**
 * Returns the backing-buffer scale currently applied to a View.
 *
 * `ResolutionScale.resolutionScale` is only the configured value. The renderer
 * applies it only while `ResolutionScale` is enabled; otherwise CSS pixels and
 * drawing-buffer pixels are 1:1.
 */
export function getEffectiveResolutionScale(view: Pick<View, "resolutionScale">): number {
  const resolutionScale = view.resolutionScale;
  return resolutionScale.applied
    ? Math.max(0.05, resolutionScale.resolutionScale)
    : 1.0;
}
