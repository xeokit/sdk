import type {Vec3} from "@xeokit/sdk/base/math/vector";

/**
 * Converts a picked surface normal into a {@link SectionPlane.dir}.
 *
 * BVH face normals follow triangle winding, which is not guaranteed to point
 * toward the camera on the visible picked face. SectionPlane.dir means "the
 * half-space to discard", so Studio orients the normal against the pick ray:
 * the clipped side is the camera side of the picked surface.
 */
export function sectionPlaneDirFromPickedNormal(
  normal: Vec3 | null | undefined,
  rayDir?: Vec3 | null,
): Vec3 {
  if (!normal) {
    return [0, 0, 1];
  }

  if (!rayDir) {
    return cleanDir(normal);
  }

  const dot =
    normal[0] * rayDir[0] +
    normal[1] * rayDir[1] +
    normal[2] * rayDir[2];

  return dot > 0
    ? cleanDir([-normal[0], -normal[1], -normal[2]])
    : cleanDir(normal);
}

function cleanDir(dir: Vec3): Vec3 {
  return [dir[0] || 0, dir[1] || 0, dir[2] || 0];
}
