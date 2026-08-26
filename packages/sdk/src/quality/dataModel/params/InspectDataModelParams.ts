import type {DataModel} from "../../../model/data";
import type {DataFormatSchema} from "../DataFormatSchema";
import type {InspectionRegistry} from "../InspectionRegistry";
import type {InspectProgress} from "./InspectProgress";


/** Parameters for {@link inspectDataModel}. */
export interface InspectDataModelParams {

  dataModel: DataModel;

  /** When supplied, schema-aware inspections (type registration,
   *  type binding, schema tagging) light up; when omitted, only
   *  the structural always-on inspections fire. */
  schema?: DataFormatSchema;

  /** Defaults to {@link DEFAULT_INSPECTION_REGISTRY}. */
  registry?: InspectionRegistry;

  /** Enable {@link schemaTagging}: compares per-entity `schema`
   *  fields against {@link DataFormatSchema.id}. */
  checkSchemaTagging?: boolean;

  /** Enable {@link relationshipTypeBinding}: validates each
   *  relationship's endpoint types against the schema's allowed-types
   *  lists, honouring super-type inheritance. */
  checkRelationshipTypeBinding?: boolean;

  /** Enable {@link relationshipCycles}: directed-graph cycle scan
   *  over container-style relationships. */
  checkRelationshipCycles?: boolean;

  /** Relationship type ids treated as containment for the cycle
   *  scan. Defaults to `IfcRelAggregates`, `IfcRelNests`,
   *  `IfcRelContainedInSpatialStructure`. */
  cycleRelationshipTypes?: readonly string[];

  /** Enable {@link ifcSpatialHierarchy}: walk the IFC
   *  Project → Site → Building → Storey → Space chain. */
  checkIfcSpatialHierarchy?: boolean;

  /** Override the canonical IFC4 allowed-parents map used by
   *  {@link ifcSpatialHierarchy}. Keyed by child type. */
  ifcSpatialParents?: { [childType: string]: readonly string[] };

  /** Aggregation relationship type used by
   *  {@link ifcSpatialHierarchy} and {@link ifcElementContainment}.
   *  Defaults to `"IfcRelAggregates"`. */
  ifcAggregationType?: string;

  /** Enable {@link ifcElementContainment}: flag IFC elements that
   *  are aggregated under a spatial structure instead of contained
   *  via `IfcRelContainedInSpatialStructure`. Needs `schema`. */
  checkIfcElementContainment?: boolean;

  /** Super-type ids that classify a DataObject as an IFC building
   *  / furnishing element. Defaults to `["IfcElement"]`; set to
   *  `["IfcBuildingElement"]` to be stricter. */
  ifcElementSuperTypes?: readonly string[];

  /** Super-type ids that classify a DataObject as an IFC spatial
   *  structure element. Defaults to
   *  `["IfcSpatialStructureElement"]`. */
  ifcSpatialStructureSuperTypes?: readonly string[];

  /** Honoured by {@link inspectDataModelAsync} only. */
  signal?: AbortSignal;

  /** Honoured by {@link inspectDataModelAsync} only. */
  onProgress?: (progress: InspectProgress) => void;
}
