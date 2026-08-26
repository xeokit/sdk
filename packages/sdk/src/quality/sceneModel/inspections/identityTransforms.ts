import type {SceneModel} from "../../../model/scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";


const IDENTITY_EPS = 1e-9;


/**
 * Flags every {@link SceneTransform} whose matrix is the 4×4
 * identity (within float epsilon). Identity transforms contribute
 * nothing to the world transform — they're either an artefact of a
 * loader that always emits a transform per node, or stale state
 * left behind after pose decomposition.
 *
 * The matching {@link dropIdentityTransform} re-parents every
 * referencing mesh / child transform to the identity transform's
 * grandparent (preserving world poses, since the missing factor is
 * identity) and then destroys it.
 *
 * Purely advisory — leaving identity transforms in place doesn't
 * break anything visually, just costs a few bytes and a
 * matrix-mul per frame.
 */
export const identityTransforms: Inspection = {

  codes: ["TRANSFORM_IDENTITY"],

  description: "Identity transforms",

  labels: {
    TRANSFORM_IDENTITY: "Identity transform",
  },

  descriptions: {
    TRANSFORM_IDENTITY:
      "Transform's matrix is the 4×4 identity, so it has no effect on placement. It costs a few bytes and a matrix-multiply per frame and can be dropped to flatten the hierarchy.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    for (const tId in sceneModel.transforms) {
      const t = sceneModel.transforms[tId];
      if (t.destroyed) continue;
      if (!isIdentityMat4(t.matrix)) continue;
      issues.push({
        severity: "warning",
        code:     "TRANSFORM_IDENTITY",
        message:  `SceneTransform '${tId}' is the 4×4 identity — contributes nothing; can be elided via dropIdentityTransform`,
        resourceId: tId,
      });
    }
    return issues;
  },
};


/**
 * 4×4 identity test, tolerant of float-precision drift on the
 * order of `IDENTITY_EPS`. Storage layout is irrelevant — the
 * identity matrix is symmetric (1s on the diagonal, 0s
 * everywhere) so the row-vs-column-major distinction collapses.
 */
function isIdentityMat4(m: ArrayLike<number>): boolean {
  if (!m || m.length < 16) return false;
  for (let i = 0; i < 16; i++) {
    const expected = (i === 0 || i === 5 || i === 10 || i === 15) ? 1 : 0;
    if (Math.abs(m[i] - expected) > IDENTITY_EPS) return false;
  }
  return true;
}
