import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";
import {IFC_SCHEMAS} from "./IFC_SCHEMAS";


/**
 * Opt-in via {@link InspectDataModelParams.checkIfcSpatialHierarchy}.
 *
 * Walks the IFC spatial-structure chain and checks:
 *
 *   - Exactly one `IfcProject`. Zero is `IFC_NO_PROJECT`; more than
 *     one is `IFC_MULTIPLE_PROJECTS`.
 *   - `IfcProject` is the root — never a child in any
 *     {@link InspectDataModelParams.ifcAggregationType | aggregation}
 *     relationship (`IFC_PROJECT_HAS_PARENT`).
 *   - Each `IfcSite` / `IfcBuilding` / `IfcBuildingStorey` /
 *     `IfcSpace` has a parent of an allowed type
 *     (`IFC_SPATIAL_PARENT_TYPE_MISMATCH`), or no parent at all
 *     (`IFC_SPATIAL_ORPHAN`).
 *
 * Allowed-parents map defaults to the canonical IFC4 chain:
 *
 * ```
 * IfcSite           ← IfcProject
 * IfcBuilding       ← IfcSite, IfcProject
 * IfcBuildingStorey ← IfcBuilding
 * IfcSpace          ← IfcBuildingStorey, IfcBuilding
 * ```
 *
 * Override per-project via
 * {@link InspectDataModelParams.ifcSpatialParents}.
 */
export const ifcSpatialHierarchy: Inspection = {

  codes: [
    "IFC_NO_PROJECT",
    "IFC_MULTIPLE_PROJECTS",
    "IFC_PROJECT_HAS_PARENT",
    "IFC_SPATIAL_PARENT_TYPE_MISMATCH",
    "IFC_SPATIAL_ORPHAN",
  ],

  description: "IFC spatial-structure hierarchy",

  schemas: IFC_SCHEMAS,

  optIn: true,
  paramsKey: "checkIfcSpatialHierarchy",

  labels: {
    IFC_NO_PROJECT:                   "IFC — no IfcProject",
    IFC_MULTIPLE_PROJECTS:             "IFC — multiple IfcProjects",
    IFC_PROJECT_HAS_PARENT:           "IFC — IfcProject has a parent",
    IFC_SPATIAL_PARENT_TYPE_MISMATCH: "IFC — spatial parent type mismatch",
    IFC_SPATIAL_ORPHAN:                "IFC — spatial element orphan",
  },

  descriptions: {
    IFC_NO_PROJECT:
      "Every IFC DataModel must have exactly one IfcProject as its " +
      "root. None was found.",
    IFC_MULTIPLE_PROJECTS:
      "An IFC DataModel must have exactly one IfcProject. Two or more " +
      "indicates an authoring or merge bug.",
    IFC_PROJECT_HAS_PARENT:
      "IfcProject is the spatial-structure root — it must not appear " +
      "as the related side of any aggregation relationship.",
    IFC_SPATIAL_PARENT_TYPE_MISMATCH:
      "A spatial structure element (IfcSite / IfcBuilding / " +
      "IfcBuildingStorey / IfcSpace) is aggregated under a parent of " +
      "the wrong type. The canonical IFC4 chain is " +
      "Project → Site → Building → BuildingStorey → Space.",
    IFC_SPATIAL_ORPHAN:
      "Spatial structure element has no parent in the aggregation " +
      "graph. IFC4 requires every Site / Building / Storey / Space " +
      "to be aggregated under its conventional parent.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    if (!params.checkIfcSpatialHierarchy) return [];

    const issues: Issue[] = [];
    const allowed = params.ifcSpatialParents ?? DEFAULT_SPATIAL_PARENTS;
    const aggType = params.ifcAggregationType ?? "IfcRelAggregates";

    // Pass 1: project counts.
    const projects: Array<{id: string}> = [];
    for (const id in dataModel.objects) {
      if (dataModel.objects[id].type === "IfcProject") {
        projects.push(dataModel.objects[id]);
      }
    }
    if (projects.length === 0) {
      issues.push({
        severity: "error",
        code:     "IFC_NO_PROJECT",
        message:  "DataModel has no IfcProject — IFC4 requires exactly one",
        summary:  "no IfcProject",
      });
    } else if (projects.length > 1) {
      for (const p of projects) {
        issues.push({
          severity:   "error",
          code:       "IFC_MULTIPLE_PROJECTS",
          message:    `IfcProject '${p.id}' is one of ${projects.length} — IFC4 allows only one`,
          summary:    `${projects.length} IfcProjects`,
          resourceId: p.id,
          context:    {projectCount: projects.length},
        });
      }
    }

    // Build child → parent map by walking the aggregation graph.
    // Same child appearing under two parents would still register
    // the last one — but that's a separate (out-of-scope) defect.
    const parentOf = new Map<string, {id: string; type: string}>();
    for (const rel of dataModel.relationships) {
      if (rel.type !== aggType) continue;
      if (!rel.relatingObject || !rel.relatedObject) continue;
      parentOf.set(rel.relatedObject.id, rel.relatingObject);
    }

    // Pass 2: project must be the root.
    for (const p of projects) {
      const parent = parentOf.get(p.id);
      if (parent) {
        issues.push({
          severity:   "error",
          code:       "IFC_PROJECT_HAS_PARENT",
          message:    `IfcProject '${p.id}' is aggregated under '${parent.id}' (type '${parent.type}')`,
          summary:    `parent '${parent.type}'`,
          resourceId: p.id,
          context:    {parentId: parent.id, parentType: parent.type},
        });
      }
    }

    // Pass 3: each spatial child has the right parent type.
    for (const id in dataModel.objects) {
      const obj = dataModel.objects[id];
      const expected = allowed[obj.type];
      if (!expected) continue;            // not a spatial structure element
      const parent = parentOf.get(id);
      if (!parent) {
        issues.push({
          severity:   "warning",
          code:       "IFC_SPATIAL_ORPHAN",
          message:    `'${obj.type}' '${id}' has no parent in '${aggType}'`,
          summary:    `orphaned '${obj.type}'`,
          resourceId: id,
          context:    {type: obj.type},
        });
        continue;
      }
      if (expected.indexOf(parent.type) === -1) {
        issues.push({
          severity:   "error",
          code:       "IFC_SPATIAL_PARENT_TYPE_MISMATCH",
          message:    `'${obj.type}' '${id}' has parent of type '${parent.type}'; allowed: [${expected.join(", ")}]`,
          summary:    `'${obj.type}' under '${parent.type}'`,
          resourceId: id,
          context:    {
            type:               obj.type,
            parentType:         parent.type,
            parentId:           parent.id,
            allowedParentTypes: expected,
          },
        });
      }
    }

    return issues;
  },
};


const DEFAULT_SPATIAL_PARENTS: Readonly<Record<string, readonly string[]>> = {
  IfcSite:           ["IfcProject"],
  IfcBuilding:       ["IfcSite", "IfcProject"],
  IfcBuildingStorey: ["IfcBuilding"],
  IfcSpace:          ["IfcBuildingStorey", "IfcBuilding", "IfcSite"],
};
