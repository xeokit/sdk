import type {SceneModel} from "../../scene";
import type {Inspection} from "../Inspection";
import type {InspectSceneModelParams} from "../InspectSceneModelParams";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../SceneModelInspectionIndex";
import {getInspectionIndex} from "../getInspectionIndex";


/**
 * Walks the SceneModel and flags resources that exist but nothing
 * references — wasted memory the SDK's `create…` methods don't
 * prevent (you can create a SceneMaterial / SceneTexture /
 * SceneTransform and never hook it up).
 *
 * Single pass over meshes / materials / transforms, three "live"
 * sets, three codes:
 *
 *   - `MATERIAL_UNUSED` — material with no referencing mesh.
 *   - `TEXTURE_UNUSED` — texture not referenced by any material's
 *     colour / normals / metallic-roughness / emissive slot.
 *   - `TRANSFORM_UNUSED` — transform not in any mesh's parent
 *     chain. A transform that *only* has child transforms but no
 *     descendant mesh-parent is still unused; the walk follows
 *     `parentTransform` from each mesh up to the root, so any
 *     transform missed by every walk is dead weight.
 *
 * No `highlight` payload — the affected resources don't render
 * anything visible. The matching `pruneUnused*Fix` strategies
 * destroy each resource in place.
 */
export const unusedResources: Inspection = {

  codes: [
    "MATERIAL_UNUSED",
    "TEXTURE_UNUSED",
    "TRANSFORM_UNUSED",
  ],

  description: "Unused materials, textures, transforms",

  labels: {
    MATERIAL_UNUSED:  "Unused material",
    TEXTURE_UNUSED:   "Unused texture",
    TRANSFORM_UNUSED: "Unused transform",
  },

  descriptions: {
    MATERIAL_UNUSED:
      "Material is declared but no mesh references it. It costs memory but draws nothing — safe to drop.",
    TEXTURE_UNUSED:
      "Texture is declared but no material references it. It occupies GPU memory and is never sampled — safe to drop.",
    TRANSFORM_UNUSED:
      "Transform is declared but no mesh or child transform sits in its subtree. It contributes nothing to placement — safe to drop.",
  },

  run(
    sceneModel: SceneModel,
    _params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    const ix = index ?? getInspectionIndex(sceneModel);
    const issues: Issue[] = [];

    // ── Materials ─────────────────────────────────────────────
    // The index's materialReferences map contains an entry for
    // every materialId mentioned by any non-destroyed mesh.
    // Anything else is unreferenced.
    const matRefs = ix.materialReferences();
    for (const matId in sceneModel.materials) {
      const mat = sceneModel.materials[matId];
      if (mat.destroyed) continue;
      if (matRefs.has(matId)) continue;
      issues.push({
        severity: "warning",
        code:     "MATERIAL_UNUSED",
        message:  `SceneMaterial '${matId}' has no referencing SceneMesh — wasted storage`,
        resourceId: matId,
      });
    }

    // ── Textures ──────────────────────────────────────────────
    // textureReferences: textureId → materialIds that bind it.
    // Texture is live iff that map has the id.
    const texRefs = ix.textureReferences();
    for (const texId in sceneModel.textures) {
      const tex = sceneModel.textures[texId];
      if (tex.destroyed) continue;
      if (texRefs.has(texId)) continue;
      issues.push({
        severity: "warning",
        code:     "TEXTURE_UNUSED",
        message:  `SceneTexture '${texId}' is not bound to any SceneMaterial slot — wasted GPU / system memory`,
        resourceId: texId,
      });
    }

    // ── Transforms ────────────────────────────────────────────
    // A transform is live iff some mesh's ancestor chain includes
    // it. The index's transformReferences map gives us direct
    // mesh referrers and child transforms; we walk upward from
    // each mesh-referenced transform once to mark every ancestor.
    // Cheaper than the previous "for-each-mesh, walk up" because
    // it visits each branch only once.
    const tRefs = ix.transformReferences();
    const liveTransforms = new Set<string>();
    for (const [tId, refs] of tRefs) {
      if (refs.meshes.length === 0) continue;
      let cursorId: string | undefined = tId;
      while (cursorId && !liveTransforms.has(cursorId)) {
        liveTransforms.add(cursorId);
        const t = sceneModel.transforms[cursorId];
        cursorId = (t && t.parentTransform) ? t.parentTransform.id : undefined;
      }
    }
    for (const tId in sceneModel.transforms) {
      const t = sceneModel.transforms[tId];
      if (t.destroyed) continue;
      if (liveTransforms.has(tId)) continue;
      issues.push({
        severity: "warning",
        code:     "TRANSFORM_UNUSED",
        message:  `SceneTransform '${tId}' is not in any SceneMesh's parent chain — dead weight`,
        resourceId: tId,
      });
    }

    return issues;
  },
};
