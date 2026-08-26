import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";
import {typeMatchesOrInherits} from "../../DataFormatSchema";
import {IFC_SCHEMAS} from "./IFC_SCHEMAS";
import {relationshipLocator} from "../generic/relationshipReferences";


/**
 * Opt-in via {@link InspectDataModelParams.checkIfcElementContainment}.
 *
 * Flags IFC building / furnishing elements that appear as the
 * **child** side of an aggregation relationship under a spatial
 * structure (`IfcSite` / `IfcBuilding` / `IfcBuildingStorey` /
 * `IfcSpace`). IFC4 convention is to attach elements to their
 * spatial container via `IfcRelContainedInSpatialStructure`, not
 * `IfcRelAggregates` — flattened exports often collapse both into
 * `IfcRelAggregates`, which slips past structural checks.
 *
 * Needs `params.schema` (uses
 * {@link typeMatchesOrInherits} to walk super-type chains for the
 * "is this an IfcElement?" / "is this a spatial structure?"
 * decisions).
 */
export const ifcElementContainment: Inspection = {

  codes: ["IFC_ELEMENT_AGGREGATED_NOT_CONTAINED"],

  description: "IFC element containment uses the right relationship",

  schemas: IFC_SCHEMAS,

  optIn: true,
  paramsKey: "checkIfcElementContainment",

  labels: {
    IFC_ELEMENT_AGGREGATED_NOT_CONTAINED:
      "IFC — element aggregated instead of contained",
  },

  descriptions: {
    IFC_ELEMENT_AGGREGATED_NOT_CONTAINED:
      "Building element is the child of an aggregation relationship " +
      "under a spatial structure. IFC4 wants element-to-spatial " +
      "containment via 'IfcRelContainedInSpatialStructure'; " +
      "'IfcRelAggregates' is reserved for parent-part decomposition " +
      "(Project → Site → Building → Storey, or one element into " +
      "constituent parts).",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    if (!params.checkIfcElementContainment) return [];
    const schema = params.schema;
    if (!schema) return [];

    const aggType        = params.ifcAggregationType            ?? "IfcRelAggregates";
    const elementSupers  = params.ifcElementSuperTypes          ?? ["IfcElement"];
    const spatialSupers  = params.ifcSpatialStructureSuperTypes ?? ["IfcSpatialStructureElement"];

    const issues: Issue[] = [];
    for (const rel of dataModel.relationships) {
      if (rel.type !== aggType) continue;
      if (!rel.relatingObject || !rel.relatedObject) continue;

      const parentIsSpatial = typeMatchesOrInherits(schema, rel.relatingObject.type, spatialSupers);
      if (!parentIsSpatial) continue;

      const childIsElement = typeMatchesOrInherits(schema, rel.relatedObject.type, elementSupers);
      if (!childIsElement) continue;

      const locator = relationshipLocator(rel);
      issues.push({
        severity:   "warning",
        code:       "IFC_ELEMENT_AGGREGATED_NOT_CONTAINED",
        message:    `Element '${rel.relatedObject.id}' (type '${rel.relatedObject.type}') is aggregated under spatial structure '${rel.relatingObject.id}' (type '${rel.relatingObject.type}'); IFC4 expects 'IfcRelContainedInSpatialStructure'`,
        summary:    `'${rel.relatedObject.type}' aggregated under '${rel.relatingObject.type}'`,
        resourceId: locator,
        context:    {
          elementId:                   rel.relatedObject.id,
          elementType:                 rel.relatedObject.type,
          spatialId:                   rel.relatingObject.id,
          spatialType:                 rel.relatingObject.type,
          recommendedRelationshipType: "IfcRelContainedInSpatialStructure",
        },
      });
    }
    return issues;
  },
};
