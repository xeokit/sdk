/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit DataModel Inspector
 *
 * ---
 *
 * **Schema-aware validator for {@link model!data.DataModel | DataModel}
 * — catches structural defects (dangling references, missing types,
 * cyclic containment) and schema-level violations (unknown types,
 * forbidden type pairings, missing required property sets) and
 * reports them as a structured {@link InspectionReport}.**
 *
 * ---
 *
 * Same shape as
 * {@link inspect!sceneModel | @xeokit/sdk/inspect/sceneModel} —
 * pluggable inspections + a default registry — minus the auto-fix
 * half. **No fixes ship for DataModel issues**: SDK policy is to
 * report defects in user data rather than silently rewrite it.
 * Triage is human work. Unlike geometry — where glitches
 * (degenerate triangles, duplicate vertices) are clearly mechanical
 * artefacts safe to clean up automatically — defects in the data
 * graph almost always reflect intentional or authoring-decision
 * content the application owner needs to see and decide on.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class inspectDataModel {
 *       +(params) InspectionReport
 *     }
 *     class InspectDataModelParams {
 *       +dataModel : DataModel
 *       +schema?   : DataFormatSchema
 *       +registry? : InspectionRegistry
 *       +checkX?   : boolean
 *     }
 *     class InspectionReport {
 *       +issues   : Issue[]
 *       +errors / warnings / info
 *       +byCode   : Map
 *     }
 *     class Issue {
 *       +code     : string
 *       +severity : error | warning | info
 *       +message  : string
 *       +resourceId? / context?
 *     }
 *     class Inspection {
 *       +codes   : string[]
 *       +schemas?: string[]
 *       +run(dataModel, push)
 *     }
 *     class InspectionRegistry
 *     class DataFormatSchema {
 *       +id                : string
 *       +objectTypes       : Map
 *       +relationshipTypes : Map
 *     }
 *     class DataModel {
 *       <<data>>
 *     }
 *     inspectDataModel ..> InspectDataModelParams : reads
 *     inspectDataModel ..> InspectionReport : returns
 *     InspectDataModelParams o-- DataModel
 *     InspectDataModelParams o-- DataFormatSchema
 *     InspectDataModelParams o-- InspectionRegistry
 *     InspectionRegistry "1" *-- "*" Inspection
 *     InspectionReport "1" *-- "*" Issue
 *     Inspection ..> DataFormatSchema : optional schemas[]
 * ```
 *
 * <br>
 *
 * ## Pipeline
 *
 * ```mermaid
 * flowchart LR
 *     A[DataModel] --> B[inspectDataModel]
 *     C[DataFormatSchema] --> B
 *     B --> D[InspectionReport]
 *     D -. errors block downstream optimisation .-> E[caller triages]
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Inspection-only** — no auto-fix half. Defects are reported as
 *   issues; the caller decides how (and whether) to remediate.
 * - **Schema-aware** — supply a {@link DataFormatSchema} and the
 *   schema-tagged inspections fire (unknown types, forbidden type
 *   pairings, required-property-set checks). Omit it and only the
 *   schema-agnostic structural inspections run.
 * - **Pluggable rules** — register custom inspections into the
 *   {@link DEFAULT_INSPECTION_REGISTRY} (or build a fresh
 *   {@link InspectionRegistry} per pipeline).
 * - **Schema segregation** — each {@link Inspection} can declare
 *   `schemas: [...]`; the orchestrator skips any inspection whose
 *   schema list doesn't match the model's schema id. IFC-tagged
 *   inspections only fire on IFC4 / IFC2x3 / IFC4x3 schemas.
 * - **Severity tiers** — `errors`, `warnings`, `info`. Same
 *   convention as {@link inspect!sceneModel | sceneModel}: errors block
 *   downstream optimisation; warnings inform.
 * - **Opt-in expensive walks** — cycle detection, schema-tagging
 *   audits, IFC-specific hierarchy / containment checks are off by
 *   default and enabled via `checkX` flags.
 * - **Async variant** — {@link inspectDataModelAsync} yields to
 *   the host periodically so very large data graphs don't block
 *   the main thread.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 *   - {@link Issue} — one finding (severity, code, message,
 *     resourceId, structured `context`).
 *   - {@link InspectionReport} — flat list plus per-severity and
 *     per-code groupings.
 *   - {@link Inspection} — `{codes[], description, run}`. Walks
 *     the DataModel and returns issues.
 *
 * ## DataFormatSchema
 *
 * The validator's rule book is a {@link DataFormatSchema} —
 * declarative spec listing allowed object types, allowed
 * relationship types, super-type chains for inheritance, and
 * per-type required / forbidden property sets. Pass one via
 * {@link InspectDataModelParams.schema}; omit it and only the
 * structural always-on inspections fire.
 *
 * ```ts
 * const schema: DataFormatSchema = {
 *   id: "MyApp/v1",
 *   objectTypes: {
 *     Building: {label: "Building"},
 *     Floor:    {superType: "Building"},
 *     Door:     {superType: "Floor", requiredPropertySets: ["DoorMetadata"]},
 *   },
 *   relationshipTypes: {
 *     contains: {
 *       allowedRelatingTypes: ["Building", "Floor"],
 *       allowedRelatedTypes:  ["Floor", "Door"],
 *     },
 *   },
 * };
 *
 * const report = inspectDataModel({dataModel, schema});
 * if (report.errors.length > 0) { ... }
 * ```
 *
 * ## Plug-in framework
 *
 * Inspections are pluggable via {@link InspectionRegistry}. The
 * SDK ships {@link DEFAULT_INSPECTION_REGISTRY} pre-loaded with
 * the built-ins; plug-ins extend it on import:
 *
 * ```ts
 * import {DEFAULT_INSPECTION_REGISTRY} from "@xeokit/sdk/inspect/dataModel";
 *
 * DEFAULT_INSPECTION_REGISTRY.register({
 *   codes: ["MyApp/CHECK_NAMING"],
 *   description: "Enforce DataObject-naming convention",
 *   run(dataModel) { ... },
 * });
 * ```
 *
 * Tests / one-off pipelines build a fresh
 * {@link InspectionRegistry} and pass it via
 * {@link InspectDataModelParams.registry}.
 *
 * ## Built-in inspections
 *
 * | Inspection                       | Codes                                                       |
 * | -------------------------------- | ----------------------------------------------------------- |
 * | {@link objectIntegrity}          | `OBJECT_MISSING_TYPE` (error), `OBJECT_DUPLICATE_PROPERTY_SET_REF` (warning) |
 * | {@link objectTypeRegistration}   | `OBJECT_UNKNOWN_TYPE` (error, when schema supplied)         |
 * | {@link relationshipReferences}   | `RELATIONSHIP_SELF_REFERENCE` (warning)                     |
 * | {@link relationshipTypeRegistration} | `RELATIONSHIP_UNKNOWN_TYPE` (error, when schema supplied) |
 * | {@link propertySetReferences}    | `OBJECT_REQUIRED_PROPERTY_SET_MISSING` / `OBJECT_FORBIDDEN_PROPERTY_SET` (warnings, when schema supplied) |
 * | {@link relationshipTypeBinding}  | `RELATIONSHIP_FORBIDDEN_RELATING_TYPE` / `RELATIONSHIP_FORBIDDEN_RELATED_TYPE` / `RELATIONSHIP_SELF_REFERENCE_FORBIDDEN` (errors, **opt-in** via `checkRelationshipTypeBinding`) |
 * | {@link schemaTagging}            | `OBJECT_SCHEMA_MISMATCH` / `RELATIONSHIP_SCHEMA_MISMATCH` (warnings, **opt-in** via `checkSchemaTagging`) |
 * | {@link relationshipCycles}       | `RELATIONSHIP_CYCLE` (error, **opt-in** via `checkRelationshipCycles`) |
 * | {@link ifcSpatialHierarchy}      | `IFC_NO_PROJECT` / `IFC_MULTIPLE_PROJECTS` / `IFC_PROJECT_HAS_PARENT` / `IFC_SPATIAL_PARENT_TYPE_MISMATCH` (errors), `IFC_SPATIAL_ORPHAN` (warning); **opt-in** via `checkIfcSpatialHierarchy`; IFC-only |
 * | {@link ifcElementContainment}    | `IFC_ELEMENT_AGGREGATED_NOT_CONTAINED` (warning, **opt-in** via `checkIfcElementContainment`); IFC-only |
 *
 * ## Schema segregation
 *
 * Each {@link Inspection} can declare {@link Inspection.schemas |
 * a list of schema ids} it applies to. The orchestrator resolves
 * the model's schema id (`params.schema?.id ?? dataModel.schema`)
 * and skips any inspection whose `schemas` list doesn't include
 * it. The IFC-tagged inspections only fire when the model's
 * schema id is one of `IFC4 / IFC4x3 / IFC4X3 / IFC4x1 / IFC4X1 /
 * IFC4_ADD2_TC1 / IFC2x3 / IFC2X3`. Schema-agnostic inspections
 * leave `schemas` undefined and run regardless. A model with no
 * schema id at all (no `dataModel.schema`, no `params.schema`)
 * runs only the schema-agnostic inspections.
 *
 * Dangling-reference checks (`RELATIONSHIP_DANGLING_*`,
 * `OBJECT_DANGLING_PROPERTY_SET_REF`) aren't included — `DataModel`'s
 * builder methods reject unknown ids at construction time, so a
 * live DataModel can't carry dangling endpoints.
 *
 * @module dataModel
 */

// ── Inspection types ────────────────────────────────────────────
export * from "./params/IssueSeverity";
export * from "./Issue";
export * from "./InspectionReport";
export * from "./params/InspectDataModelParams";
export * from "./params/InspectProgress";
export * from "./inspectDataModel";
export * from "./async/inspectDataModelAsync";
export * from "./serializers/inspectionReportToJson";
export * from "./labels/labelForCode";
export * from "./labels/descriptionForCode";

// ── Schema spec ─────────────────────────────────────────────────
export * from "./DataFormatSchema";

// ── Inspection plugin framework + built-in inspections ──────────
export * from "./Inspection";
export * from "./InspectionRegistry";
export * from "./DEFAULT_INSPECTION_REGISTRY";
export * from "./inspections";
