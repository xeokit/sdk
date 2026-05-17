import {DrawOps} from "../drawOps/DrawOps";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {DrawOp} from "../drawOps/DrawOp";
import {DrawTechnique} from "../drawOps";


/**
 * A vertex / fragment shader source pair, in both stripped
 * (comment-free, compilable) and commented (annotated, possibly
 * not compilable) form.
 */
export interface ShaderSource {

  /**
   * The original shader source code, with comments removed.
   */
  vertexShaderSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  vertexShaderCommentedSrc: string;

  /**
   * The original shader source code, with comments removed.
   */
  fragmentShaderSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  fragmentShaderCommentedSrc: string;
}

/**
 * Names of the Lambert-style draw-technique variants that a
 * single {@link DrawTechniqueRecord} may carry. Each variant is
 * an independently compiled program selected at draw time
 * according to the {@link MeshBatch}'s `(hasNormals, hasUVs,
 * triplanar)` flag triple.
 */
export type ShaderVariantName =
  | "withNormals"
  | "withUVs"
  | "withNormalsAndUVs"
  | "withTriplanar"
  | "withNormalsAndTriplanar";

/**
 * Compile-time configuration captured from a
 * {@link DrawTechnique} — surfaced alongside the shader source
 * so introspection tools (the shaders panel, batch dumps) can
 * tell at a glance which slots use, e.g., the thick-line
 * 6-vertex quad-expansion path vs. the legacy 2-vertex GL_LINES
 * path.
 */
export interface DrawTechniqueConfig {
  /**
   * Number of vertices emitted per primitive: `3` for
   * triangles, `2` for legacy GL_LINES, `6` for the new
   * thick-line quad expansion, `1` for points. Pulled
   * directly from the technique's public field.
   */
  vertsPerPrim: number;
  /**
   * `true` for techniques that drive the renderer's thick-line
   * path (currently {@link ThickLinesDrawColorTechnique}). The
   * `_draw` switch in the base technique uses this to route
   * through `gl.drawArrays(gl.TRIANGLES, …, n × 6)` instead of
   * `gl.drawElements(gl.LINES, …)`, and the vertex shader
   * derives quad-corner positions from `gl_VertexID`.
   */
  thickLines: boolean;
}


/**
 * One Lambert variant of a {@link DrawTechniqueRecord}. Carries
 * its own vertex / fragment shader source pair plus the
 * constructor name of the underlying {@link DrawTechnique} so
 * tools can disambiguate identically-named entries.
 */
export interface ShaderVariantRecord extends ShaderSource {
  /**
   * Constructor name of the underlying {@link DrawTechnique}
   * subclass that compiled this variant — e.g.
   * `"TrianglesDrawColorTechnique"`. Useful for filtering and
   * for distinguishing two passes that share a base technique
   * (e.g. opaque + transparent both refer to the same
   * `TrianglesDrawColorTechnique`).
   */
  className: string;
  /**
   * Compile-time technique config — same shape as the parent
   * record's `config`, captured per-variant so variant-specific
   * differences (rare today but possible) stay visible.
   */
  config: DrawTechniqueConfig;
}

/**
 * One render-pass slot's compiled shader program — the base
 * (flat-shaded, no-UVs) variant, plus the optional set of
 * Lambert variants compiled into the same slot.
 *
 * `ShaderTechniqueRecord` extends {@link ShaderSource}, so
 * callers that only care about the base program can read its
 * fields directly without descending into `variants`.
 */
export interface DrawTechniqueRecord extends ShaderSource {
  /**
   * Constructor name of the underlying {@link DrawTechnique}
   * subclass — e.g. `"TrianglesDrawColorTechnique"`.
   */
  className: string;

  /**
   * Compile-time technique config — `vertsPerPrim` and the
   * `thickLines` flag, captured from the underlying
   * {@link DrawTechnique}. Surfaces the renderer's quad-expanded
   * thick-line path so inspectors can flag those slots distinctly
   * from the legacy GL_LINES path.
   */
  config: DrawTechniqueConfig;

  /**
   * Optional Lambert-style variants compiled into this slot.
   * Absent (or empty) for slots that don't vary on
   * `(hasNormals, hasUVs, triplanar)`, e.g. silhouette / pick /
   * edge / shadow-depth / snap passes.
   */
  variants?: Partial<Record<ShaderVariantName, ShaderVariantRecord>>;
}

/**
 * Map from render-pass slot name (as defined on
 * {@link RenderPassDrawOps}, e.g. `"opaque"`, `"opaqueSAO"`,
 * `"transparentEdges"`, `"snapVertex"`) to its compiled
 * {@link DrawTechniqueRecord}.
 */
export type DrawTechniqueRecordMap = Record<string, DrawTechniqueRecord>;

/**
 * Read-only view of every shader program compiled into the
 * renderer's draw pipeline. Surfaces one record per
 * `(primitive, render-pass)` slot in {@link DrawOps.prims},
 * plus the full set of Lambert variants (`withNormals`,
 * `withUVs`, `withNormalsAndUVs`, `withTriplanar`,
 * `withNormalsAndTriplanar`) compiled into each slot.
 *
 * Bookkeeping is dynamic — the inspector walks the live
 * `DrawOps.prims` map at construction, so new draw-op slots
 * added to {@link RenderPassDrawOps} (or new Lambert variant
 * slots added to {@link DrawOp}) show up without further
 * inspector changes.
 */
export class ShaderInspector {

  public readonly techniques: {
    triangles: DrawTechniqueRecordMap,
    lines: DrawTechniqueRecordMap,
    points: DrawTechniqueRecordMap,
  };

  constructor(drawOps: DrawOps) {
    this.techniques = {
      triangles: collectTechniques(drawOps.prims[TrianglesPrimitive]),
      lines:     collectTechniques(drawOps.prims[LinesPrimitive]),
      points:    collectTechniques(drawOps.prims[PointsPrimitive]),
    };
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Slot keys to inspect on each {@link DrawOp} for Lambert
 * variants. Driven by {@link DrawOp}'s public field shape; kept
 * here so the inspector doesn't have to import the DrawOp
 * variant interface separately.
 */
const VARIANT_SLOTS: ReadonlyArray<{
  prop: keyof DrawOp;
  name: ShaderVariantName;
}> = [
  {prop: "techniqueWithNormals",             name: "withNormals"},
  {prop: "techniqueWithUVs",                 name: "withUVs"},
  {prop: "techniqueWithNormalsAndUVs",       name: "withNormalsAndUVs"},
  {prop: "techniqueWithTriplanar",           name: "withTriplanar"},
  {prop: "techniqueWithNormalsAndTriplanar", name: "withNormalsAndTriplanar"},
];

function collectTechniques(passes: object | undefined): DrawTechniqueRecordMap {
  const out: DrawTechniqueRecordMap = {};
  if (!passes) return out;
  const map = passes as Record<string, DrawOp | undefined>;
  for (const passKey of Object.keys(map)) {
    const op = map[passKey];
    if (!op) continue;
    out[passKey] = buildRecord(op);
  }
  return out;
}

function buildRecord(op: DrawOp): DrawTechniqueRecord {
  const record: DrawTechniqueRecord = {
    ...readShaderSource(op.technique),
    className: op.technique.constructor.name,
    config:    readTechniqueConfig(op.technique),
  };
  let variants: Partial<Record<ShaderVariantName, ShaderVariantRecord>> | undefined;
  for (const slot of VARIANT_SLOTS) {
    const tech = op[slot.prop] as DrawTechnique | null | undefined;
    if (!tech) continue;
    if (!variants) variants = {};
    variants[slot.name] = {
      ...readShaderSource(tech),
      className: tech.constructor.name,
      config:    readTechniqueConfig(tech),
    };
  }
  if (variants) record.variants = variants;
  return record;
}


function readTechniqueConfig(tech: DrawTechnique): DrawTechniqueConfig {
  return {
    vertsPerPrim: tech.vertsPerPrim,
    thickLines:   tech.thickLines === true,
  };
}

function readShaderSource(tech: DrawTechnique): ShaderSource {
  return {
    vertexShaderSrc:            tech.vertexShaderSrc,
    vertexShaderCommentedSrc:   tech.vertexShaderCommentedSrc,
    fragmentShaderSrc:          tech.fragmentShaderSrc,
    fragmentShaderCommentedSrc: tech.fragmentShaderCommentedSrc,
  };
}
