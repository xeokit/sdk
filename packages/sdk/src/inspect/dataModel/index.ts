/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # DataModel Inspector
 *
 * Runs inspections on a {@link model!data.DataModel | DataModel}
 * and returns a structured {@link InspectionReport}.
 *
 * The inspector does not modify the model. It reports issues for
 * callers to handle. Provide a {@link DataFormatSchema} to enable
 * schema-specific checks; omit it to run only schema-agnostic
 * checks.
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
 * ## Pipeline
 *
 * ```mermaid
 * flowchart LR
 *     A[DataModel] --> B[inspectDataModel]
 *     C[DataFormatSchema] --> B
 *     B --> D[InspectionReport]
 *     D -. errors .-> E[caller handles report]
 * ```
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Core Types
 *
 * - {@link Issue}: one finding with severity, code, message,
 *   optional resource id, and optional `context`.
 * - {@link InspectionReport}: issue list plus severity and code
 *   groupings.
 * - {@link Inspection}: `{codes[], description, run}`. Walks a
 *   DataModel and returns issues.
 *
 * ## DataFormatSchema
 *
 * A {@link DataFormatSchema} lists allowed object types, allowed
 * relationship types, inheritance chains, and required or
 * forbidden property sets. Pass one via
 * {@link InspectDataModelParams.schema}.
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
 * ## Registries
 *
 * Inspections are stored in an {@link InspectionRegistry}.
 * {@link DEFAULT_INSPECTION_REGISTRY} contains the built-in
 * inspections. Plugins can register more inspections:
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
 * Tests and one-off pipelines can create a fresh
 * {@link InspectionRegistry} and pass it with
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
 * ## Schema Selection
 *
 * Each {@link Inspection} can declare {@link Inspection.schemas |
 * a list of schema ids}. The inspector resolves the model's
 * schema id from `params.schema?.id ?? dataModel.schema` and skips
 * inspections whose `schemas` list does not include it.
 *
 * IFC inspections run only for `IFC4 / IFC4x3 / IFC4X3 / IFC4x1 /
 * IFC4X1 / IFC4_ADD2_TC1 / IFC2x3 / IFC2X3`. Inspections without
 * `schemas` run for any model. A model with no schema id runs only
 * schema-agnostic inspections.
 *
 * Dangling-reference checks (`RELATIONSHIP_DANGLING_*`,
 * `OBJECT_DANGLING_PROPERTY_SET_REF`) aren't included because
 * `DataModel` builder methods reject unknown ids at construction time, so a
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

// ── Inspection registries and built-in inspections ──────────────
export * from "./Inspection";
export * from "./InspectionRegistry";
export * from "./DEFAULT_INSPECTION_REGISTRY";
export * from "./inspections";
