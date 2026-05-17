/**
 * Identifies the currently-hovered or currently-active handle of a
 * {@link TransformControls}. `null` when no handle is hovered or active.
 *
 * - Translate / scale mode: `"X"`, `"Y"`, `"Z"`, `"XY"`, `"YZ"`,
 *   `"XZ"`, `"XYZ"` (centre / uniform handle).
 * - Rotate mode: `"X"`, `"Y"`, `"Z"`, `"E"` (view-aligned ring),
 *   `"XYZE"` (view-aligned trackball).
 */
export type TransformControlsAxis =
  | "X" | "Y" | "Z"
  | "XY" | "YZ" | "XZ"
  | "XYZ"
  | "E" | "XYZE"
  | null;
