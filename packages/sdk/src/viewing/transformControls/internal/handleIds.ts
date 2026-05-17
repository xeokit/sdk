// Handle SceneObject ids. Each is also the "axis" string surfaced as
// TransformControlsAxis when that handle is hovered or being dragged.

const P = (mode: string, axis: string) => `__tc.${mode}.${axis}`;

// Translate
export const T_X    = P("t", "X");
export const T_Y    = P("t", "Y");
export const T_Z    = P("t", "Z");
export const T_XY   = P("t", "XY");
export const T_YZ   = P("t", "YZ");
export const T_XZ   = P("t", "XZ");
export const T_XYZ  = P("t", "XYZ");   // centre free-move

// Rotate
export const R_X    = P("r", "X");
export const R_Y    = P("r", "Y");
export const R_Z    = P("r", "Z");
export const R_E    = P("r", "E");     // view-aligned ring
export const R_XYZE = P("r", "XYZE");  // view-aligned trackball

// Scale
export const S_X    = P("s", "X");
export const S_Y    = P("s", "Y");
export const S_Z    = P("s", "Z");
export const S_XY   = P("s", "XY");
export const S_YZ   = P("s", "YZ");
export const S_XZ   = P("s", "XZ");
export const S_XYZ  = P("s", "XYZ");   // centre uniform

export const TRANSLATE_HANDLES = [T_X, T_Y, T_Z, T_XY, T_YZ, T_XZ, T_XYZ];
export const ROTATE_HANDLES    = [R_X, R_Y, R_Z, R_E, R_XYZE];
export const SCALE_HANDLES     = [S_X, S_Y, S_Z, S_XY, S_YZ, S_XZ, S_XYZ];
export const ALL_HANDLES       = [...TRANSLATE_HANDLES, ...ROTATE_HANDLES, ...SCALE_HANDLES];

// Hover-helper SceneObject ids. The helpers are thin overlay primitives
// that toggle visible on hover to indicate the axis (or axes) along
// which the current handle constrains motion / rotation — same
// convention as three.js's gizmoHelper. Helpers share the gizmo's
// `root × meshLocal` composition just like the visible handles and the
// companion pickers, so they track the target's pivot every frame.
export const H_AXIS_X    = "__tc.helper.axis.X";
export const H_AXIS_Y    = "__tc.helper.axis.Y";
export const H_AXIS_Z    = "__tc.helper.axis.Z";

export const HELPER_IDS = [H_AXIS_X, H_AXIS_Y, H_AXIS_Z];

/**
 * Returns the helper SceneObject ids to show while `axisLabel` is the
 * active hover or drag axis. The mapping shows the X/Y/Z axis line(s)
 * along which the current handle moves or rotates:
 *
 * - axis handle (X/Y/Z): one axis line
 * - plane handle (XY/YZ/XZ): the two in-plane axis lines
 * - centre handle (XYZ): all three axis lines
 * - view-aligned rotate handles (E / XYZE): no axis-aligned helper
 */
export function helpersForAxis(axisLabel: string): string[] {
  switch (axisLabel) {
    case "X":   return [H_AXIS_X];
    case "Y":   return [H_AXIS_Y];
    case "Z":   return [H_AXIS_Z];
    case "XY":  return [H_AXIS_X, H_AXIS_Y];
    case "YZ":  return [H_AXIS_Y, H_AXIS_Z];
    case "XZ":  return [H_AXIS_X, H_AXIS_Z];
    case "XYZ": return [H_AXIS_X, H_AXIS_Y, H_AXIS_Z];
    default:    return [];
  }
}

/**
 * Returns the THREE-style axis string ("X", "Y", "Z", "XY", ..., "XYZ",
 * "E", "XYZE") for a given handle SceneObject id.
 */
export function axisOf(handleId: string): string {
  const parts = handleId.split(".");
  return parts[parts.length - 1] ?? "";
}
