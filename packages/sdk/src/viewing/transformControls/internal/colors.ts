import type {Vec3} from "../../../base/math/vector";

// Strong, saturated axis colours, intended for the unlit overlay-bin
// render path (no Lambert / SAO darkening) — at full intensity each
// axis reads clearly against any host scene. Hover / active state
// swaps to COLOR_HIGHLIGHT (pure yellow).
export const COLOR_X:        Vec3 = [1.00, 0.10, 0.15];   // pure red    (X axis)
export const COLOR_Y:        Vec3 = [0.20, 0.95, 0.20];   // pure green  (Y axis)
export const COLOR_Z:        Vec3 = [0.15, 0.40, 1.00];   // pure blue   (Z axis)
export const COLOR_HIGHLIGHT: Vec3 = [1.00, 1.00, 0.10];  // pure yellow (hover / active)
export const COLOR_CENTER:   Vec3 = [0.95, 0.95, 0.95];   // near-white  (XYZ free / uniform)
export const COLOR_E:        Vec3 = [0.75, 0.75, 0.75];   // light gray  (view-aligned ring)
export const COLOR_PLANE_XY: Vec3 = [0.15, 0.40, 1.00];   // blue  plane on Z
export const COLOR_PLANE_YZ: Vec3 = [1.00, 0.10, 0.15];   // red   plane on X
export const COLOR_PLANE_XZ: Vec3 = [0.20, 0.95, 0.20];   // green plane on Y
