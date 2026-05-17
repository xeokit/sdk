/**
 * Interaction mode of a {@link TransformControls}.
 *
 * - `"translate"` — drag axis arrows, plane handles, or the centre
 *   cube to translate the target.
 * - `"rotate"` — drag axis rings, the view-aligned ring, or the
 *   trackball sphere to rotate the target.
 * - `"scale"` — drag axis sticks, plane handles, or the centre cube
 *   to scale the target.
 * - `"none"` — hide every handle without detaching the target.
 */
export type TransformControlsMode = "translate" | "rotate" | "scale" | "none";
