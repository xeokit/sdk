import type {DataModel} from "../../../data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";


/**
 * Opt-in via {@link InspectDataModelParams.checkRelationshipCycles}.
 *
 * Directed-graph cycle scan over container-style relationship
 * types. Cycle types default to a small built-in list; override
 * via {@link InspectDataModelParams.cycleRelationshipTypes}. Emits
 * one issue per cycle, with the vertex chain in `context.cycle`.
 */
export const relationshipCycles: Inspection = {

  codes: ["RELATIONSHIP_CYCLE"],

  description: "Container relationships form a DAG",

  optIn: true,
  paramsKey: "checkRelationshipCycles",

  labels: {
    RELATIONSHIP_CYCLE: "Relationship — cycle in container graph",
  },

  descriptions: {
    RELATIONSHIP_CYCLE:
      "Containment / aggregation relationships form a directed " +
      "cycle — an object is transitively its own parent. By spec " +
      "container relationships are acyclic.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    if (!params.checkRelationshipCycles) return [];

    const cycleTypes = params.cycleRelationshipTypes ?? DEFAULT_CYCLE_TYPES;
    const issues: Issue[] = [];

    for (const type of cycleTypes) {
      // parent → children adjacency. relating is the parent.
      const adj = new Map<string, string[]>();
      for (const rel of dataModel.relationships) {
        if (rel.type !== type) continue;
        if (!rel.relatingObject || !rel.relatedObject) continue;
        const a = rel.relatingObject.id;
        const b = rel.relatedObject.id;
        let bucket = adj.get(a);
        if (!bucket) { bucket = []; adj.set(a, bucket); }
        bucket.push(b);
      }
      if (adj.size === 0) continue;

      const visited = new Set<string>();
      const onStack = new Set<string>();
      const stackPath: string[] = [];

      // DFS from every node — handles disconnected components.
      for (const start of adj.keys()) {
        if (visited.has(start)) continue;
        dfs(start);
      }

      function dfs(node: string): void {
        visited.add(node);
        onStack.add(node);
        stackPath.push(node);
        const next = adj.get(node);
        if (next) {
          for (const child of next) {
            if (onStack.has(child)) {
              // Back-edge — slice out the cycle from `child`'s
              // position on the stack and append it again to close
              // the loop visually.
              const idx = stackPath.indexOf(child);
              const cycle = idx >= 0
                ? [...stackPath.slice(idx), child]
                : [child, ...stackPath];
              issues.push({
                severity:   "error",
                code:       "RELATIONSHIP_CYCLE",
                message:    `Relationship type '${type}' has a cycle: ${cycle.join(" → ")}`,
                summary:    `cycle of ${cycle.length - 1} via '${type}'`,
                resourceId: `${cycle[0]}#${type}`,
                context:    {type, cycle},
              });
              continue;
            }
            if (!visited.has(child)) dfs(child);
          }
        }
        onStack.delete(node);
        stackPath.pop();
      }
    }

    return issues;
  },
};


const DEFAULT_CYCLE_TYPES: readonly string[] = [
  "IfcRelAggregates",
  "IfcRelNests",
  "IfcRelContainedInSpatialStructure",
];
