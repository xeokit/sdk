import type {SceneMesh, SceneModel, SceneObject} from "../../../model/scene";
import type {SDKResult} from "../../../base/core";
import {SDKErrorType} from "../../../base/core";
import {decompressPositions3WithAABB3} from "../../../base/math/compression";
import type {Mat4} from "../../../base/math/matrix";
import {createMat4Float64, mulMat4} from "../../../base/math/matrix";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";
import {getInspectionIndex} from "../internal/getInspectionIndex";


// Acceptance threshold for the fit residual, expressed as a
// fraction of the canonical geometry's AABB diagonal. The Kabsch
// fit assumes the similar geometry's vertex order matches the
// canonical's; if the orders are scrambled the residual blows up
// well past this gate, and the fix returns `fixed:false` rather
// than baking a wrong transform.
const RESIDUAL_THRESHOLD_FRAC = 1e-3;


/**
 * Auto-fix for `GEOMETRY_SIMILAR`.
 *
 * For each similar geometry in `issue.context.similar`, computes
 * the rigid transform `T : similarLocal → canonicalLocal` via
 * Kabsch / Horn's quaternion method on the dequantized vertex
 * positions, then bakes `T⁻¹` into each referencing mesh's matrix
 * and repoints the mesh at the canonical geometry — so the world
 * placement of every transformed mesh is preserved while the
 * scene now stores a single canonical copy of the shape.
 *
 * **Best-effort under same-vertex-order assumption.** Kabsch
 * needs a vertex correspondence; this fix uses positional
 * correspondence by index (vertex `k` of similar pairs with
 * vertex `k` of canonical). That holds for the common case
 * (templated exporters that emit byte-different but
 * order-preserved instances) but not when the loader has
 * reordered vertices. Geometries whose fit residual exceeds the
 * tolerance gate are skipped — left in place rather than
 * silently mis-aligned.
 *
 * Constraints:
 *
 *   - A similar geometry whose meshes did not all redirect (because
 *     its fit failed the residual gate, say) is left in place
 *     rather than destroyed mid-bind.
 */
export const mergeSimilarGeometries: Fix = {

  codes: ["GEOMETRY_SIMILAR"],

  description: "Instance similar geometries via per-mesh transforms",

  procedure: [
    "Dequantize the canonical geometry's vertex positions",
    "For each similar geometry, fit a rigid transform via Kabsch (Horn's quaternion method) under same-vertex-order correspondence",
    "Skip similars whose fit residual exceeds the tolerance gate",
    "For each accepted similar, bake the inverse transform into each referencing mesh's matrix and repoint the mesh at the canonical geometry",
    "Destroy similar geometries with no remaining references",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableMergeSimilarGeometries",
      label: "Instance similar geometries",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const canonicalId = issue.resourceId;
    if (!canonicalId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[mergeSimilarGeometries] issue has no resourceId (canonical geometry id)`,
      };
    }
    const ctx = issue.context;
    const rawSimilar = ctx ? ctx.similar : undefined;
    const similars = (Array.isArray(rawSimilar) && rawSimilar.every(x => typeof x === "string"))
      ? (rawSimilar as string[])
      : undefined;
    if (!similars || similars.length === 0) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    const canonical = sceneModel.geometries[canonicalId];
    if (!canonical || canonical.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (!canonical.positionsCompressed || !canonical.aabb || !canonical.indices) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }

    const canonicalPositions = decompressPositions3WithAABB3(
      canonical.positionsCompressed, canonical.aabb,
    ) as Float32Array;
    const canonicalDiag = aabbDiagonal(canonical.aabb);
    const tolerance = canonicalDiag * RESIDUAL_THRESHOLD_FRAC;

    let totalRebuilt = 0;
    const acceptedSimilars: string[] = [];
    const skippedSimilars:  string[] = [];

    for (const similarId of similars) {
      const similar = sceneModel.geometries[similarId];
      if (!similar || similar.destroyed) continue;
      if (!similar.positionsCompressed || !similar.aabb) {
        skippedSimilars.push(similarId);
        continue;
      }
      if (similar.positionsCompressed.length !== canonical.positionsCompressed.length) {
        // Defensive — the inspection groups by vertex count so this
        // shouldn't fire, but a stale issue against a since-mutated
        // geometry could trip it.
        skippedSimilars.push(similarId);
        continue;
      }

      const similarPositions = decompressPositions3WithAABB3(
        similar.positionsCompressed, similar.aabb,
      ) as Float32Array;

      const T = fitRigidTransform(similarPositions, canonicalPositions, tolerance);
      if (!T) {
        skippedSimilars.push(similarId);
        continue;
      }
      // T : similarLocal → canonicalLocal. Each referencing mesh
      // currently has world = M · v_S. After repointing to canonical
      // we want world = M' · v_C with v_S = T⁻¹ · v_C. So
      // M' = M · T⁻¹.
      const Tinv = createMat4Float64();
      invertRigidMat4(T, Tinv);

      const targets = collectReferencingMeshSnapshots(sceneModel, similarId);

      let rebuiltForThisSimilar = 0;
      for (const {sceneObjectId, snap} of targets) {
        const obj = sceneModel.objects[sceneObjectId];
        if (!obj || obj.destroyed) continue;
        const mesh = sceneModel.meshes[snap.id];
        if (!mesh || mesh.destroyed) continue;

        const newMatrix = createMat4Float64();
        mulMat4(snap.matrix, Tinv, newMatrix);

        const rRes = obj.removeMesh(snap.id);
        if (rRes.ok === false) return rRes;
        const dRes = mesh.destroy();
        if (dRes.ok === false) return dRes;

        const cRes = sceneModel.createMesh({
          id:         snap.id,
          geometryId: canonicalId,
          matrix:     newMatrix,
          color:      snap.color,
          opacity:    snap.opacity,
          ...(snap.materialId ? {materialId: snap.materialId} : {}),
          ...(snap.bin !== undefined ? {bin: snap.bin} : {}),
        });
        if (cRes.ok === false) return cRes;
        const aRes = obj.addMesh(cRes.value.id);
        if (aRes.ok === false) {
          const cleanupRes = cleanupCreatedMesh(obj, cRes.value);
          if (cleanupRes.ok === false) return cleanupRes;
          return aRes;
        }
        if (snap.parentTransformId) {
          const tRes = cRes.value.setParentTransformId(snap.parentTransformId);
          if (tRes.ok === false) {
            const cleanupRes = cleanupCreatedMesh(obj, cRes.value);
            if (cleanupRes.ok === false) return cleanupRes;
            return tRes;
          }
        }
        rebuiltForThisSimilar++;
      }
      totalRebuilt += rebuiltForThisSimilar;
      acceptedSimilars.push(similarId);
    }

    // Destroy similar geometries with no remaining references.
    // Gated against the mutation-aware reverse index — if any mesh still
    // points at a similar (a fit failed mid-cluster, say) we leave that
    // geometry in place rather than destroy a bound resource. O(1) per
    // similar instead of re-scanning every mesh here.
    const index = getInspectionIndex(sceneModel);
    const destroyed: string[] = [];
    for (const id of acceptedSimilars) {
      if (index.geometryMeshes(id).length > 0) continue;
      const g = sceneModel.geometries[id];
      if (!g || g.destroyed) continue;
      const r = g.destroy();
      if (r.ok === false) return r;
      destroyed.push(id);
    }

    if (totalRebuilt === 0 && destroyed.length === 0) {
      return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    }
    const skippedNote = skippedSimilars.length > 0
      ? `, skipped ${skippedSimilars.length} (fit residual above tolerance)`
      : "";
    const trace =
      `'${canonicalId}' kept; instanced ${totalRebuilt} mesh${totalRebuilt === 1 ? "" : "es"} ` +
      `from ${acceptedSimilars.length} similar geometr${acceptedSimilars.length === 1 ? "y" : "ies"}${skippedNote}` +
      (destroyed.length > 0 ? `, destroyed: ${destroyed.join(", ")}` : "");
    return {ok: true, value: {fixed: true, trace}};
  },
};


function cleanupCreatedMesh(
  sceneObject: SceneObject,
  mesh: SceneMesh,
): SDKResult<void> {
  if (mesh.object?.id === sceneObject.id) {
    const rRes = sceneObject.removeMesh(mesh.id);
    if (rRes.ok === false) return rRes;
  }
  if (!mesh.destroyed) {
    return mesh.destroy();
  }
  return {ok: true, value: undefined};
}


// ── Mesh snapshot helpers ────────────────────────────────────────

interface MeshSnap {
  id:                string;
  matrix:            Float64Array<any>;
  color:             [number, number, number];
  opacity:           number;
  materialId:        string | undefined;
  bin:               string | undefined;
  parentTransformId: string | undefined;
}

function collectReferencingMeshSnapshots(
  sceneModel: SceneModel,
  geometryId: string,
): Array<{sceneObjectId: string; snap: MeshSnap}> {
  const out: Array<{sceneObjectId: string; snap: MeshSnap}> = [];
  // Mutation-aware reverse index: O(1) per geometry instead of an
  // all-meshes scan, and it stays correct as this fix destroys/creates
  // meshes (the index tracks those events). geometryMeshes returns a
  // snapshot array, safe to hold while the caller then mutates.
  const index = getInspectionIndex(sceneModel);
  for (const meshId of index.geometryMeshes(geometryId)) {
    const mesh = sceneModel.meshes[meshId];
    if (!mesh || mesh.destroyed) continue;
    if (mesh.geometryId !== geometryId) continue;
    const obj = mesh.object;
    if (!obj || obj.destroyed) continue;
    out.push({
      sceneObjectId: obj.id,
      snap: {
        id:                mesh.id,
        matrix:            new Float64Array(mesh.matrix),
        color:             [mesh.color[0], mesh.color[1], mesh.color[2]],
        opacity:           mesh.opacity,
        materialId:        mesh.materialId,
        bin:               mesh.bin,
        parentTransformId: mesh.parentTransform ? mesh.parentTransform.id : undefined,
      },
    });
  }
  return out;
}


// ── Rigid transform fit (Kabsch via Horn's quaternion method) ────

/**
 * Find rigid transform T (rotation + translation) such that
 * `T · P[i] ≈ Q[i]` under same-vertex-order correspondence, using
 * Horn's quaternion method (one 4×4 symmetric eigendecomposition,
 * no SVD).
 *
 * Returns the Mat4 in xeokit column-major form, or `null` when:
 *
 *   - fewer than 3 vertices (under-determined),
 *   - the input cloud is degenerate (collapsed to a point/line —
 *     trace of N is near zero),
 *   - the maximum vertex residual after the fit exceeds
 *     `tolerance` (vertex orders don't match, or the actual
 *     transform is improper, e.g. includes a reflection).
 */
function fitRigidTransform(
  P: Float32Array,
  Q: Float32Array,
  tolerance: number,
): Mat4 | null {
  const n = (P.length / 3) | 0;
  if (n < 3) return null;

  // Centroids
  let pcx = 0, pcy = 0, pcz = 0;
  let qcx = 0, qcy = 0, qcz = 0;
  for (let i = 0; i < n; i++) {
    pcx += P[i * 3];     pcy += P[i * 3 + 1]; pcz += P[i * 3 + 2];
    qcx += Q[i * 3];     qcy += Q[i * 3 + 1]; qcz += Q[i * 3 + 2];
  }
  pcx /= n; pcy /= n; pcz /= n;
  qcx /= n; qcy /= n; qcz /= n;

  // Cross-covariance H = Σ (p_i − pc) (q_i − qc)ᵀ
  let Sxx = 0, Sxy = 0, Sxz = 0;
  let Syx = 0, Syy = 0, Syz = 0;
  let Szx = 0, Szy = 0, Szz = 0;
  for (let i = 0; i < n; i++) {
    const px = P[i * 3]     - pcx;
    const py = P[i * 3 + 1] - pcy;
    const pz = P[i * 3 + 2] - pcz;
    const qx = Q[i * 3]     - qcx;
    const qy = Q[i * 3 + 1] - qcy;
    const qz = Q[i * 3 + 2] - qcz;
    Sxx += px * qx; Sxy += px * qy; Sxz += px * qz;
    Syx += py * qx; Syy += py * qy; Syz += py * qz;
    Szx += pz * qx; Szy += pz * qy; Szz += pz * qz;
  }

  // Horn's 4×4 symmetric N matrix; the unit eigenvector with the
  // largest eigenvalue is the optimal quaternion (qw, qx, qy, qz).
  const N = new Float64Array(16);
  N[0]  = Sxx + Syy + Szz; N[1]  = Syz - Szy;       N[2]  = Szx - Sxz;       N[3]  = Sxy - Syx;
  N[4]  = Syz - Szy;       N[5]  = Sxx - Syy - Szz; N[6]  = Sxy + Syx;       N[7]  = Szx + Sxz;
  N[8]  = Szx - Sxz;       N[9]  = Sxy + Syx;       N[10] = -Sxx + Syy - Szz; N[11] = Syz + Szy;
  N[12] = Sxy - Syx;       N[13] = Szx + Sxz;       N[14] = Syz + Szy;       N[15] = -Sxx - Syy + Szz;

  // Magnitude bail-out for collapsed clouds (point / line). Trace
  // of NᵀN is ~Σ Sᵢⱼ²; if every covariance is near zero the input
  // can't pin a rotation.
  const cloudMag = Sxx*Sxx + Syy*Syy + Szz*Szz + Sxy*Sxy + Sxz*Sxz + Syz*Syz + Syx*Syx + Szx*Szx + Szy*Szy;
  if (cloudMag < 1e-20) return null;

  const V = new Float64Array(16);
  const eigenvalues = jacobiEigen4(N, V);

  // Pick the column of V with the largest eigenvalue.
  let best = 0;
  for (let i = 1; i < 4; i++) if (eigenvalues[i] > eigenvalues[best]) best = i;
  const qw = V[0  * 4 + best];
  const qx = V[1  * 4 + best];
  const qy = V[2  * 4 + best];
  const qz = V[3  * 4 + best];
  const qLen = Math.sqrt(qw*qw + qx*qx + qy*qy + qz*qz);
  if (qLen < 1e-9) return null;
  const iqLen = 1 / qLen;
  const w = qw * iqLen, x = qx * iqLen, y = qy * iqLen, z = qz * iqLen;

  // Quaternion → rotation matrix (row-major rᵢⱼ).
  const r00 = 1 - 2*(y*y + z*z);
  const r01 = 2*(x*y - z*w);
  const r02 = 2*(x*z + y*w);
  const r10 = 2*(x*y + z*w);
  const r11 = 1 - 2*(x*x + z*z);
  const r12 = 2*(y*z - x*w);
  const r20 = 2*(x*z - y*w);
  const r21 = 2*(y*z + x*w);
  const r22 = 1 - 2*(x*x + y*y);

  // Translation: t = qc − R · pc
  const tx = qcx - (r00 * pcx + r01 * pcy + r02 * pcz);
  const ty = qcy - (r10 * pcx + r11 * pcy + r12 * pcz);
  const tz = qcz - (r20 * pcx + r21 * pcy + r22 * pcz);

  // Validate: maximum vertex residual after the fit. If the actual
  // transform is improper (reflection) or the vertex orders don't
  // match, this gate catches it cleanly.
  let maxResidualSq = 0;
  for (let i = 0; i < n; i++) {
    const px = P[i * 3];
    const py = P[i * 3 + 1];
    const pz = P[i * 3 + 2];
    const tx_i = r00 * px + r01 * py + r02 * pz + tx;
    const ty_i = r10 * px + r11 * py + r12 * pz + ty;
    const tz_i = r20 * px + r21 * py + r22 * pz + tz;
    const dx = tx_i - Q[i * 3];
    const dy = ty_i - Q[i * 3 + 1];
    const dz = tz_i - Q[i * 3 + 2];
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 > maxResidualSq) maxResidualSq = d2;
  }
  if (Math.sqrt(maxResidualSq) > tolerance) return null;

  // Pack into xeokit column-major Mat4.
  const T = createMat4Float64();
  T[0]  = r00; T[1]  = r10; T[2]  = r20; T[3]  = 0;
  T[4]  = r01; T[5]  = r11; T[6]  = r21; T[7]  = 0;
  T[8]  = r02; T[9]  = r12; T[10] = r22; T[11] = 0;
  T[12] = tx;  T[13] = ty;  T[14] = tz;  T[15] = 1;
  return T;
}


/**
 * Inverse of a rigid (rotation + translation) Mat4 in xeokit
 * column-major form. Cheaper and more numerically stable than the
 * generic 4×4 inverse: Rᵀ for the rotation block, −Rᵀ·t for the
 * translation column.
 */
function invertRigidMat4(M: Mat4, dest: Mat4): void {
  const r00 = M[0], r10 = M[1], r20 = M[2];
  const r01 = M[4], r11 = M[5], r21 = M[6];
  const r02 = M[8], r12 = M[9], r22 = M[10];
  const tx  = M[12], ty = M[13], tz = M[14];
  // Rᵀ
  dest[0]  = r00; dest[1]  = r01; dest[2]  = r02; dest[3]  = 0;
  dest[4]  = r10; dest[5]  = r11; dest[6]  = r12; dest[7]  = 0;
  dest[8]  = r20; dest[9]  = r21; dest[10] = r22; dest[11] = 0;
  // −Rᵀ·t
  dest[12] = -(r00 * tx + r10 * ty + r20 * tz);
  dest[13] = -(r01 * tx + r11 * ty + r21 * tz);
  dest[14] = -(r02 * tx + r12 * ty + r22 * tz);
  dest[15] = 1;
}


/**
 * Jacobi eigendecomposition of a 4×4 symmetric matrix. Cyclic
 * sweep variant — six off-diagonal positions per sweep, ~5–10
 * sweeps to converge to ~1e-12. Eigenvectors come back as the
 * columns of `V` (4×4 row-major); eigenvalues are returned as a
 * Float64Array of length 4 in the same column order.
 */
function jacobiEigen4(A: Float64Array, V: Float64Array): Float64Array {
  // V := identity
  for (let i = 0; i < 16; i++) V[i] = 0;
  for (let i = 0; i < 4; i++) V[i * 4 + i] = 1;

  const MAX_SWEEPS = 50;
  const EPS = 1e-14;

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let off = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const v = A[i * 4 + j];
        off += v * v;
      }
    }
    if (off < EPS) break;

    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        const apq = A[p * 4 + q];
        if (Math.abs(apq) < 1e-16) continue;
        const app = A[p * 4 + p];
        const aqq = A[q * 4 + q];
        const theta = (aqq - app) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        A[p * 4 + p] = app - t * apq;
        A[q * 4 + q] = aqq + t * apq;
        A[p * 4 + q] = 0;
        A[q * 4 + p] = 0;
        for (let i = 0; i < 4; i++) {
          if (i === p || i === q) continue;
          const aip = A[i * 4 + p];
          const aiq = A[i * 4 + q];
          A[i * 4 + p] = c * aip - s * aiq;
          A[p * 4 + i] = A[i * 4 + p];
          A[i * 4 + q] = s * aip + c * aiq;
          A[q * 4 + i] = A[i * 4 + q];
        }
        for (let i = 0; i < 4; i++) {
          const vip = V[i * 4 + p];
          const viq = V[i * 4 + q];
          V[i * 4 + p] = c * vip - s * viq;
          V[i * 4 + q] = s * vip + c * viq;
        }
      }
    }
  }

  return new Float64Array([A[0], A[5], A[10], A[15]]);
}


function aabbDiagonal(aabb: ArrayLike<number>): number {
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
