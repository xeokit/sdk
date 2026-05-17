/**
 * # step — ISO 10303-21 STEP Importer
 *
 * ---
 *
 * **Loads ASCII STEP (`.step` / `.stp`) — the EXPRESS-encoded
 * exchange format used by mechanical CAD tooling (CATIA, NX,
 * SolidWorks, Creo, …) — into xeokit's
 * {@link model!scene.SceneModel | SceneModel} and
 * {@link model!data.DataModel | DataModel}.**
 *
 * ---
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class STEPLoader {
 *       +format : "STEP"
 *       +load(params, options?) Promise~void~
 *     }
 *     class AP203Parser
 *     class AP214Parser
 *     class AP242Parser
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- STEPLoader
 *     STEPLoader o-- AP203Parser : per-schema
 *     STEPLoader o-- AP214Parser : per-schema
 *     STEPLoader o-- AP242Parser : per-schema
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Schema sniffing** — auto-detects the schema (AP203 / AP214 /
 *   AP242) from the file's `FILE_SCHEMA(...)` header and dispatches
 *   to the matching parser.
 * - **Multi-instance assemblies** — `NEXT_ASSEMBLY_USAGE_OCCURRENCE`
 *   composition is unrolled into per-occurrence SceneObjects with
 *   `id#1, id#2, …` ids and per-occurrence world matrices.
 * - **Planar B-Rep tessellation** — `MANIFOLD_SOLID_BREP` /
 *   `FACETED_BREP` / `BREP_WITH_VOIDS` faces are fan-triangulated
 *   with flat per-face normals. Curved surfaces fall back to the
 *   AABB-sized placeholder cube (curved-surface tessellation
 *   pending).
 * - **DataModel mirror** — each occurrence becomes a SceneObject +
 *   DataObject pair; the PRODUCT graph is preserved as
 *   parent / child relationships.
 *
 * ## Loader
 *
 * {@link STEPLoader} matches the same shape as the other format
 * loaders ({@link formats!ifc.IFCLoader | IFCLoader}, {@link formats!rvm.RVMLoader | RVMLoader},
 * {@link formats!dotbim.DotBIMLoader | DotBIMLoader}): the constructor registers per-schema
 * parsers and a `getVersion` hook that sniffs the file's
 * `FILE_SCHEMA(...)` declaration. Recognised schema tags route to
 * one of the AP203 / AP214 / AP242 parsers.
 *
 * **Status:** partial — instance-graph walker landed.
 *
 *   - HEADER + version dispatch.
 *   - Full EXPRESS instance graph parser with inverse-ref index.
 *   - Per-PRODUCT placement: canonical `PRODUCT → PRODUCT_DEFINITION
 *     → SHAPE_DEFINITION_REPRESENTATION → AXIS2_PLACEMENT_3D` chain,
 *     plus `MAPPED_ITEM` and assembly composition via
 *     `NEXT_ASSEMBLY_USAGE_OCCURRENCE` /
 *     `CONTEXT_DEPENDENT_SHAPE_REPRESENTATION` /
 *     `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION` /
 *     `ITEM_DEFINED_TRANSFORMATION` (with full
 *     `inverse(transform_item_1)` composition).
 *   - **Multi-instance** — a PRODUCT used in N NAUOs yields N
 *     distinct SceneObjects with `id#1, id#2, …` ids and
 *     per-occurrence world matrices.
 *   - **Planar B-Rep tessellation** for `MANIFOLD_SOLID_BREP`
 *     (and `FACETED_BREP` / `BREP_WITH_VOIDS`): per-face fan
 *     triangulation of `PLANE`-bounded faces with flat per-face
 *     normals. Curved surfaces (`CYLINDRICAL_SURFACE` / NURBS /
 *     …) and curved edges aren't sampled yet — those parts fall
 *     back to the AABB-sized placeholder cube.
 *   - One {@link model!scene.SceneObject | SceneObject} + {@link model!data.DataObject | DataObject} per
 *     occurrence, pointing at either (a) the per-PD tessellated
 *     mesh (shared by reference across all occurrences of the
 *     same PD) or (b) the AABB-scaled placeholder cube.
 *
 * Curved-surface tessellation, concave-face ear clipping, and
 * hole punching are the remaining geometry pieces. The planar
 * pass already renders faceted CAD parts correctly.
 *
 * @example
 * ```ts
 * import {STEPLoader} from "@xeokit/sdk/formats/step";
 *
 * const loader = new STEPLoader();
 * await loader.load({fileData, sceneModel, dataModel});
 * ```
 *
 * @module step
 */
export * from "./STEPLoader";
