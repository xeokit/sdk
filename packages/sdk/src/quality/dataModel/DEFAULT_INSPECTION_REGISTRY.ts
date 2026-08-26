import {InspectionRegistry} from "./InspectionRegistry";
import {objectIntegrity}              from "./inspections/generic/objectIntegrity";
import {objectTypeRegistration}       from "./inspections/schema/objectTypeRegistration";
import {relationshipReferences}       from "./inspections/generic/relationshipReferences";
import {relationshipTypeRegistration} from "./inspections/schema/relationshipTypeRegistration";
import {propertySetReferences}        from "./inspections/schema/propertySetReferences";
import {relationshipTypeBinding}      from "./inspections/schema/relationshipTypeBinding";
import {schemaTagging}                from "./inspections/schema/schemaTagging";
import {relationshipCycles}           from "./inspections/generic/relationshipCycles";
import {ifcSpatialHierarchy}          from "./inspections/ifc/ifcSpatialHierarchy";
import {ifcElementContainment}        from "./inspections/ifc/ifcElementContainment";


/**
 * Default {@link InspectionRegistry} consulted by
 * {@link inspectDataModel} when no `registry` is supplied.
 * Pre-populated with the built-ins from
 * {@link dataModelInspector/inspections}.
 *
 * Plug-ins extend the singleton on import:
 *
 * ```ts
 * import {DEFAULT_INSPECTION_REGISTRY} from "@xeokit/sdk/quality/dataModel";
 *
 * DEFAULT_INSPECTION_REGISTRY.register({
 *   codes: ["MyApp/CHECK_NAMING"],
 *   description: "Enforce DataObject-naming convention",
 *   run(dataModel) { ... },
 * });
 * ```
 */
export const DEFAULT_INSPECTION_REGISTRY: InspectionRegistry = new InspectionRegistry([
  objectIntegrity,
  objectTypeRegistration,
  relationshipReferences,
  relationshipTypeRegistration,
  propertySetReferences,
  relationshipTypeBinding,
  schemaTagging,
  relationshipCycles,
  ifcSpatialHierarchy,
  ifcElementContainment,
]);
