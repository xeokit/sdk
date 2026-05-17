import {ModelLoader} from "../ModelLoader";
import {parse as parse_AP214} from "./versions/AP214/parse";

/**
 * Loads an ISO 10303-21 STEP file (`.step` / `.stp`) into a {@link
 * model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel |
 * DataModel}.
 *
 * STEP is the ASCII-encoded EXPRESS-language exchange format used
 * by mechanical CAD tooling (CATIA, NX, SolidWorks, Creo, …). The
 * top-level shape mirrors {@link formats!ifc.IFCLoader | IFCLoader} and
 * {@link formats!rvm.RVMLoader | RVMLoader} — one constructor wires per-schema parsers
 * and a {@link getVersion} hook that sniffs the `FILE_SCHEMA(...)`
 * declaration in the HEADER section to pick one.
 *
 * Schema tags currently dispatched (all routed through the AP214
 * parser today; split when the schemas diverge in handling):
 *
 *   - `AP203` / `CONFIG_CONTROL_DESIGN` — early aerospace / shape exchange.
 *   - `AP214` / `AUTOMOTIVE_DESIGN`     — automotive + general MCAD (default).
 *   - `AP242` / `MANAGED_MODEL_BASED_3D_ENGINEERING` — modern superset of AP203 + AP214.
 *
 * **Status:** partial — instance-graph walker landed.
 *
 *   - HEADER parsing + version dispatch.
 *   - Full EXPRESS instance graph (`Map<#ref, Entity>` plus an
 *     inverse referrers index).
 *   - Per-PRODUCT placement: walks the canonical
 *     `PRODUCT → PRODUCT_DEFINITION_FORMATION → PRODUCT_DEFINITION
 *     → PRODUCT_DEFINITION_SHAPE → SHAPE_DEFINITION_REPRESENTATION
 *     → SHAPE_REPRESENTATION → AXIS2_PLACEMENT_3D` chain, with
 *     `MAPPED_ITEM` honoured.
 *   - Top-down assembly composition
 *     (`NEXT_ASSEMBLY_USAGE_OCCURRENCE` +
 *     `CONTEXT_DEPENDENT_SHAPE_REPRESENTATION` +
 *     `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION` +
 *     `ITEM_DEFINED_TRANSFORMATION`), with
 *     `relative = matrix_of(item_2) × inverse(matrix_of(item_1))`
 *     (the inverse is short-circuited when item_1 is identity).
 *   - **Multi-instance** — a PRODUCT used in N NAUOs yields N
 *     distinct {@link model!scene.SceneObject | SceneObject}s with id-suffixed
 *     `id#1, id#2, …` ids and per-occurrence world matrices.
 *   - **Planar B-Rep tessellation.** Walks
 *     `MANIFOLD_SOLID_BREP / BREP_WITH_VOIDS / FACETED_BREP →
 *     CLOSED_SHELL → ADVANCED_FACE → FACE_OUTER_BOUND → EDGE_LOOP →
 *     ORIENTED_EDGE → EDGE_CURVE → VERTEX_POINT → CARTESIAN_POINT`,
 *     fan-triangulates each `PLANE` face into per-face flat-normal
 *     triangles. Curved surfaces (CYLINDRICAL_SURFACE, B_SPLINE_…)
 *     emit no triangles for now and the part falls back to the
 *     AABB-sized placeholder cube.
 *   - One SceneObject + {@link model!data.DataObject | DataObject} per occurrence,
 *     each pointing at the per-PD tessellated geometry (shared
 *     across all occurrences via a `Map<TessellatedGeometry, id>`
 *     dedup) or — when tessellation produces no triangles — the
 *     shared placeholder cube scaled to the part's AABB.
 *
 * The remaining tessellation work is the curved-surface family —
 * cylinders / cones / spheres / tori first, NURBS later — plus
 * concave-face ear clipping and hole punching. The planar-only
 * pass already renders faceted CAD parts correctly.
 *
 * For detailed usage, refer to {@link step | @xeokit/sdk/formats/step}.
 */
export class STEPLoader extends ModelLoader {
  constructor() {
    super({
      format: "STEP",
      fileDataType: "text",
      parsers: {
        "AP203": parse_AP214,
        "AP214": parse_AP214,
        "AP242": parse_AP214,
      },
      // Sniff the HEADER's `FILE_SCHEMA(('<tag>'))` to route. STEP
      // allows arbitrary whitespace + multi-line strings, so the
      // regex is tolerant. Falls back to AP214 — the most-common
      // mechanical-design schema — when nothing matches.
      getVersion: (fileData: any): string => {
        if (typeof fileData !== "string") return "AP214";
        const m = fileData.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
        if (!m) return "AP214";
        const tag = m[1].toUpperCase();
        if (tag.includes("AP242") ||
            tag.includes("MANAGED_MODEL_BASED_3D_ENGINEERING")) return "AP242";
        if (tag.includes("AP203") ||
            tag.includes("CONFIG_CONTROL_DESIGN")) return "AP203";
        return "AP214";
      }
    });
  }
}
