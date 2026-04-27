import {DrawTechnique} from "./DrawTechnique";
import {type RenderPassValue} from "../RENDER_PASSES";
import {type MeshBatch} from "../meshManager/MeshBatch";

/**
 * Variant configuration for a Lambert-style {@link DrawOp} that has up to
 * four pre-compiled {@link DrawTechnique}s — one per `(hasNormals, hasUVs)`
 * combination. Only the flat/no-UVs `technique` is required; missing
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
 * Lambert colour ops typically supply 4 variants. Edge, silhouette, pick,
 * shadow-depth and snap ops only need the flat/no-UVs default and ignore
 * both flags.
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

  /** The render pass in which this draw operation is executed. */
  public readonly renderPass: RenderPassValue;

  /**
   * Creates a new DrawOp.
   *
   * Two constructor forms are accepted for convenience:
   *   1. `new DrawOp(technique, renderPass)` — single-variant op
   *   2. `new DrawOp(variants, renderPass)` — multi-variant op
   *
   * The legacy positional form `new DrawOp(technique, renderPass, withNormals)`
   * also still works for backward compatibility with call sites that haven't
   * been migrated to the variants object.
   */
  constructor(
    techniqueOrVariants: DrawTechnique | DrawOpVariants,
    renderPass: RenderPassValue,
    legacyWithNormals: DrawTechnique | null = null
  ) {
    this.renderPass = renderPass;
    if (techniqueOrVariants instanceof DrawTechnique) {
      // Legacy positional form — single technique plus optional smooth/no-UV
      // sibling. Kept so existing single-variant call sites don't break.
      this.technique = techniqueOrVariants;
      this.techniqueWithNormals       = legacyWithNormals;
      this.techniqueWithUVs           = null;
      this.techniqueWithNormalsAndUVs = null;
    } else {
      // Variants-object form — populates all four slots up front.
      this.technique = techniqueOrVariants.technique;
      this.techniqueWithNormals       = techniqueOrVariants.withNormals ?? null;
      this.techniqueWithUVs           = techniqueOrVariants.withUVs ?? null;
      this.techniqueWithNormalsAndUVs = techniqueOrVariants.withNormalsAndUVs ?? null;
    }
  }

  /**
   * Picks the most-specific technique available for the batch's flag set.
   *
   * Selection order:
   *   1. Exact match on (hasNormals, hasUVs)
   *   2. Drop the UV requirement
   *   3. Drop the normals requirement
   *   4. Fall back to the flat/no-UVs default
   */
  private _select(meshBatch: MeshBatch): DrawTechnique {
    if (meshBatch.hasNormals && meshBatch.hasUVs && this.techniqueWithNormalsAndUVs) {
      return this.techniqueWithNormalsAndUVs;
    }
    if (meshBatch.hasNormals && this.techniqueWithNormals) {
      return this.techniqueWithNormals;
    }
    if (meshBatch.hasUVs && this.techniqueWithUVs) {
      return this.techniqueWithUVs;
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

