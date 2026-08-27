import {DrawTechnique} from "./DrawTechnique";
import {type RenderPassValue} from "../RENDER_PASSES";
import {type MeshBatch} from "../meshManager/MeshBatch";

/**
 * Variant configuration for a Lambert-style {@link DrawOp} that has up to
 * six pre-compiled {@link DrawTechnique}s — one per `(hasNormals, hasUVs,
 * triplanar)` combination (with `hasUVs && triplanar` excluded by
 * construction). Only the flat/no-UVs `technique` is required; missing
 * variants fall through to closer matches at draw time.
 */
export interface DrawOpVariants {
  /** Flat-shaded, no UVs. Always required. */
  technique: DrawTechnique;
  /** Smooth-shaded, no UVs. Used when batch has normals but no UVs. */
  withNormals?: DrawTechnique;
  /** Flat-shaded, with UVs. Rare; included for completeness. */
  withUVs?: DrawTechnique;
  /** Smooth-shaded, with UVs. The texture-ready PBR variant. */
  withNormalsAndUVs?: DrawTechnique;
  /**
   * Flat-shaded triplanar — textured material on UV-less
   * geometry, world-space sampling with face-normal blend
   * weights derived from `dFdx/dFdy(vWorldPos)`.
   */
  withTriplanar?: DrawTechnique;
  /**
   * Smooth-shaded triplanar — textured material on UV-less
   * geometry, world-space sampling with blend weights derived
   * from per-vertex normals rotated to world space.
   */
  withNormalsAndTriplanar?: DrawTechnique;
  /** Hatch-enabled flat body variant. Used only while body hatch is active. */
  withBodyHatch?: DrawTechnique;
  /** Hatch-enabled smooth body variant. Used only while body hatch is active. */
  withNormalsBodyHatch?: DrawTechnique;
}

/**
 * A draw operation (DrawOp) binds one or more {@link DrawTechnique}s to a
 * specific render pass.
 *
 * DrawOp is intentionally lightweight: it contains no rendering logic of its
 * own — it just routes a {@link MeshBatch} to the right technique variant
 * and forwards the draw call.
 *
 * Variant axes (per-batch flags consulted by {@link _select}):
 *   - `hasNormals` — batch carries per-vertex normals
 *   - `hasUVs`     — batch carries per-vertex UV coordinates
 *
 * Lambert colour ops typically supply 4 variants. Shadow-depth supplies a UV
 * variant so alpha-mapped surfaces can discard cutout texels while rendering
 * shadow maps. Edge, silhouette, pick and snap ops only need the flat/no-UVs
 * default and ignore both flags.
 *
 * @internal
 */
export class DrawOp {

  /**
   * The default (flat-shaded, no-UVs) draw technique. Always present; used
   * as the fallback when no closer variant is supplied.
   */
  public readonly technique: DrawTechnique;

  /** Smooth-shaded, no-UVs variant. */
  public readonly techniqueWithNormals: DrawTechnique | null;

  /** Flat-shaded, with-UVs variant. */
  public readonly techniqueWithUVs: DrawTechnique | null;

  /** Smooth-shaded, with-UVs variant. */
  public readonly techniqueWithNormalsAndUVs: DrawTechnique | null;

  /** Flat-shaded triplanar variant (no per-vertex normals). */
  public readonly techniqueWithTriplanar: DrawTechnique | null;

  /** Smooth-shaded triplanar variant. */
  public readonly techniqueWithNormalsAndTriplanar: DrawTechnique | null;

  /** Hatch-enabled flat body variant. */
  public readonly techniqueWithBodyHatch: DrawTechnique | null;

  /** Hatch-enabled smooth body variant. */
  public readonly techniqueWithNormalsBodyHatch: DrawTechnique | null;

  /** The render pass in which this draw operation is executed. */
  public readonly renderPass: RenderPassValue;

  /**
   * Creates a new DrawOp.
   *
   * Two constructor forms are accepted for convenience:
   *   1. `new DrawOp(technique, renderPass)` — single-variant op
   *   2. `new DrawOp(variants, renderPass)` — multi-variant op
   */
  constructor(
    techniqueOrVariants: DrawTechnique | DrawOpVariants,
    renderPass: RenderPassValue
  ) {
    this.renderPass = renderPass;
    if (techniqueOrVariants instanceof DrawTechnique) {
      // Single-technique form — only the base technique slot is populated.
      this.technique = techniqueOrVariants;
      this.techniqueWithNormals             = null;
      this.techniqueWithUVs                 = null;
      this.techniqueWithNormalsAndUVs       = null;
      this.techniqueWithTriplanar           = null;
      this.techniqueWithNormalsAndTriplanar = null;
      this.techniqueWithBodyHatch           = null;
      this.techniqueWithNormalsBodyHatch    = null;
    } else {
      // Variants-object form — populates all six slots up front.
      this.technique = techniqueOrVariants.technique;
      this.techniqueWithNormals             = techniqueOrVariants.withNormals ?? null;
      this.techniqueWithUVs                 = techniqueOrVariants.withUVs ?? null;
      this.techniqueWithNormalsAndUVs       = techniqueOrVariants.withNormalsAndUVs ?? null;
      this.techniqueWithTriplanar           = techniqueOrVariants.withTriplanar ?? null;
      this.techniqueWithNormalsAndTriplanar = techniqueOrVariants.withNormalsAndTriplanar ?? null;
      this.techniqueWithBodyHatch           = techniqueOrVariants.withBodyHatch ?? null;
      this.techniqueWithNormalsBodyHatch    = techniqueOrVariants.withNormalsBodyHatch ?? null;
    }
  }

  /**
   * Picks the most-specific technique available for the batch's flag set.
   *
   * Selection order:
   *   1. Exact match on (hasNormals, hasUVs, triplanar)
   *   2. Drop the UV / triplanar requirement
   *   3. Drop the normals requirement
   *   4. Fall back to the flat/no-UVs default
   *
   * `triplanar` is only checked when `hasUVs` is false — they're
   * mutually exclusive at the batch level. A triplanar batch with
   * no triplanar variant configured falls through to the
   * un-textured path (degraded but not broken).
   *
   * Body-hatch gate: when `view.effects.bodyHatch.applied` is
   * true, the texture-sampling variants (`withUVs`,
   * `withTriplanar`, `withNormalsAndUVs`,
   * `withNormalsAndTriplanar`) are skipped in favour of the
   * plain Lambert paths so the material's hatch / colour
   * appearance dominates the body. Profile systems decide when to
   * enable that effect — the renderer just reads the boolean.
   * Section-plane caps are unaffected: cap
   * rendering reads the material's hatch independently.
   */
  private _select(meshBatch: MeshBatch): DrawTechnique {
    const view = (this.technique as any)._renderContext?.activeView;
    const allowTextureVariants = !view?.effects?.bodyHatch?.applied;

    if (!allowTextureVariants && meshBatch.hasNormals && this.techniqueWithNormalsBodyHatch) {
      return this.techniqueWithNormalsBodyHatch;
    }
    if (!allowTextureVariants && this.techniqueWithBodyHatch) {
      return this.techniqueWithBodyHatch;
    }
    if (allowTextureVariants && meshBatch.hasNormals && meshBatch.hasUVs && this.techniqueWithNormalsAndUVs) {
      return this.techniqueWithNormalsAndUVs;
    }
    if (allowTextureVariants && meshBatch.hasNormals && meshBatch.triplanar && this.techniqueWithNormalsAndTriplanar) {
      return this.techniqueWithNormalsAndTriplanar;
    }
    if (meshBatch.hasNormals && this.techniqueWithNormals) {
      return this.techniqueWithNormals;
    }
    if (allowTextureVariants && meshBatch.hasUVs && this.techniqueWithUVs) {
      return this.techniqueWithUVs;
    }
    if (allowTextureVariants && meshBatch.triplanar && this.techniqueWithTriplanar) {
      return this.techniqueWithTriplanar;
    }
    return this.technique;
  }

  /**
   * Draws all meshes contained in the given {@link MeshBatch}, within
   * this DrawOp's render pass.
   */
  public drawBatch(meshBatch: MeshBatch): void {
    this._select(meshBatch).drawBatch(meshBatch, this.renderPass);
  }

  /**
   * Draws a single mesh from the given {@link MeshBatch}, within this
   * DrawOp's render pass.
   */
  public drawMesh(meshBatch: MeshBatch, meshIndex: number): void {
    this._select(meshBatch).drawMesh(meshBatch, meshIndex, this.renderPass);
  }
}
