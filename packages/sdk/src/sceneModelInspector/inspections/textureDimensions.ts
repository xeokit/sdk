import type {SceneModel} from "../../scene";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkTextureSanity}).
 * Two cheap dimension checks per SceneTexture:
 *
 *   - `TEXTURE_NPOT` — width or height isn't a power of two.
 *     Mipmap filtering is undefined or fall-back-quality on older
 *     GPUs (GL ES 2 era / WebGL 1) for NPOT textures; modern
 *     WebGL 2 handles them but mip generation is still cheaper for
 *     POT.
 *   - `TEXTURE_OVERSIZED` — width or height above
 *     {@link InspectSceneModelParams.maxTextureDim} (default
 *     `4096`). Memory pressure + GPU upload cost; a 4K × 4K RGBA
 *     texture is ~67 MB before mipmaps.
 *
 * Textures with zero width / height (image not yet loaded, or
 * `image: undefined`) are skipped — there's nothing to evaluate.
 *
 * No matching auto-fix ships with the SDK — both remediations
 * (resize / downsample) need image-manipulation tooling and lossy
 * judgement calls, so they're left for manual triage.
 */
export const textureDimensions: Inspection = {

  codes: ["TEXTURE_NPOT", "TEXTURE_OVERSIZED"],

  description: "Texture dimensions (non-power-of-two, oversized)",

  labels: {
    TEXTURE_NPOT:      "Non-power-of-two texture",
    TEXTURE_OVERSIZED: "Oversized texture",
  },

  descriptions: {
    TEXTURE_NPOT:
      "Texture dimensions aren't powers of two. Mipmap generation is more expensive on the GPU, and some wrap modes and compressed formats behave unexpectedly on NPOT textures, especially on older drivers.",
    TEXTURE_OVERSIZED:
      "Texture exceeds the per-texture pixel budget. A 4K × 4K RGBA texture is ~67 MB before mipmaps; downsampling cuts memory dramatically with negligible visual loss for parts that never fill the screen.",
  },

  optIn: true,
  paramsKey: "checkTextureSanity",

  run(sceneModel: SceneModel, params: InspectSceneModelParams): Issue[] {
    if (!params.checkTextureSanity) return [];

    const maxTextureDim = params.maxTextureDim ?? 4096;
    const issues: Issue[] = [];

    for (const texId in sceneModel.textures) {
      const tex = sceneModel.textures[texId];
      if (tex.destroyed) continue;
      const w = tex.width  | 0;
      const h = tex.height | 0;
      if (w <= 0 || h <= 0) continue;     // image not yet sized

      if (!isPowerOfTwo(w) || !isPowerOfTwo(h)) {
        issues.push({
          severity: "warning",
          code:     "TEXTURE_NPOT",
          message:  `SceneTexture '${texId}' is ${w}×${h} — non-power-of-two; mipmap quality / GPU compatibility risk`,
          summary:  `${w}×${h}`,
          resourceId: texId,
          context:   {width: w, height: h},
        });
      }
      if (w > maxTextureDim || h > maxTextureDim) {
        issues.push({
          severity: "warning",
          code:     "TEXTURE_OVERSIZED",
          message:  `SceneTexture '${texId}' is ${w}×${h} — exceeds the ${maxTextureDim}-pixel budget on at least one axis; ~${estimateBytesMB(w, h)} MB before mipmaps`,
          summary:  `${w}×${h}`,
          resourceId: texId,
          context:   {width: w, height: h, maxTextureDim},
        });
      }
    }
    return issues;
  },
};


/** True iff `n` is a positive power of two. */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}


/** Rough RGBA8 byte estimate, in MB. */
function estimateBytesMB(w: number, h: number): string {
  return (w * h * 4 / (1024 * 1024)).toFixed(1);
}
