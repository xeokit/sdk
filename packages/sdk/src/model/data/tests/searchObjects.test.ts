import {Data} from "../Data";
import {searchObjects} from "../searchObjects";
import {SDKErrorType} from "../../../base/core";

// Relationship types in this SDK are plain strings (e.g. "BasicAggregation",
// used directly throughout the loaders) — there are no numeric constants for
// them. The DataObject.related map is keyed by these strings.
const AGGREGATES = "BasicAggregation";

// Builds a small REAL aggregation hierarchy in a fresh Data:
//
//   Building (IfcBuilding)
//     ├─ Storey1 (IfcBuildingStorey)
//     │    └─ Wall1 (IfcWall)
//     └─ Storey2 (IfcBuildingStorey)
//          └─ Wall2 (IfcWall)
//
// Edges are real Relationships of type AGGREGATES. createObject /
// createRelationship take effect immediately (there is no build() step), and
// each call returns an SDKResult we assert succeeded.
function buildData() {
  const data = new Data();
  const model = data.createModel({id: "myModel"}).value!;

  const obj = (id: string, type: string) => {
    const r = model.createObject({id, type, name: id});
    expect(r.ok).toBe(true);
  };
  const rel = (relatingObjectId: string, relatedObjectId: string) => {
    const r = model.createRelationship({type: AGGREGATES, relatingObjectId, relatedObjectId});
    expect(r.ok).toBe(true);
  };

  obj("Building", "IfcBuilding");
  obj("Storey1", "IfcBuildingStorey");
  obj("Storey2", "IfcBuildingStorey");
  obj("Wall1", "IfcWall");
  obj("Wall2", "IfcWall");

  rel("Building", "Storey1");
  rel("Building", "Storey2");
  rel("Storey1", "Wall1");
  rel("Storey2", "Wall2");

  return data;
}

describe("searchObjects", () => {

  it("collects all descendants depth-first from a start object via resultObjectIds", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    const result = searchObjects(data, {startObjectId: "Building", resultObjectIds});

    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();   // returns void on success
    // Depth-first: each subtree is fully visited before moving to the next
    // sibling. Relationships were added in insertion order, so Storey1's
    // subtree (incl. Wall1) comes before Storey2's.
    expect(resultObjectIds).toEqual(["Building", "Storey1", "Wall1", "Storey2", "Wall2"]);
  });

  it("populates data.rootObjects with only objects that have no incoming relationship", () => {
    const data = buildData();
    // Building is the sole root; the storeys and walls are all related children.
    expect(Object.keys(data.rootObjects)).toEqual(["Building"]);
    expect(data.rootObjects["Building"].id).toBe("Building");
    expect(data.rootObjects["Storey1"]).toBeUndefined();
    expect(data.rootObjects["Wall1"]).toBeUndefined();

    // The owning model mirrors the same root set.
    expect(Object.keys(data.models["myModel"].rootObjects)).toEqual(["Building"]);
  });

  it("traverses from data.rootObjects when no start object is supplied", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    // With rootObjects now populated, the default branch (no startObjectId /
    // startObject) walks the whole forest from its roots.
    const result = searchObjects(data, {resultObjectIds});

    expect(result.ok).toBe(true);
    expect(resultObjectIds).toEqual(["Building", "Storey1", "Wall1", "Storey2", "Wall2"]);
  });

  it("collects DataObjects via resultObjects, and resultObjectIds takes precedence", () => {
    const data = buildData();
    const resultObjects: any[] = [];
    searchObjects(data, {startObjectId: "Building", resultObjects});
    expect(resultObjects.map(o => o.id)).toEqual(["Building", "Storey1", "Wall1", "Storey2", "Wall2"]);

    // When both sinks are supplied, resultObjectIds wins (checked first in the source).
    const ids: string[] = [];
    const objs: any[] = [];
    searchObjects(data, {startObjectId: "Building", resultObjectIds: ids, resultObjects: objs});
    expect(ids).toHaveLength(5);
    expect(objs).toHaveLength(0);
  });

  it("invokes resultCallback per match and stops the whole traversal when it returns true", () => {
    const data = buildData();
    const seen: string[] = [];

    // Returning true from a nested callback aborts the whole DFS, including
    // children below the current node and later siblings of its ancestors.
    searchObjects(data, {
      startObjectId: "Building",
      resultCallback: (o) => { seen.push(o.id); return o.id === "Storey1"; }
    });

    expect(seen).toEqual(["Building", "Storey1"]);
  });

  it("honours includeStart:false by dropping only the depth-0 start object", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    // includeStart is only applied at depth 0, which is the startObjectId path.
    searchObjects(data, {startObjectId: "Building", includeStart: false, resultObjectIds});

    expect(resultObjectIds).toEqual(["Storey1", "Wall1", "Storey2", "Wall2"]);
    expect(resultObjectIds).not.toContain("Building");
  });

  it("honours includeStart:false when starting from a DataObject instance", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    searchObjects(data, {
      startObject: data.objects.Building,
      includeStart: false,
      resultObjectIds
    });

    expect(resultObjectIds).toEqual(["Storey1", "Wall1", "Storey2", "Wall2"]);
    expect(resultObjectIds).not.toContain("Building");
  });

  it("visits each object once when relationships contain a cycle", () => {
    const data = new Data();
    const model = data.createModel({id: "cyclic"}).value!;
    model.createObject({id: "A", type: "Thing", name: "A"});
    model.createObject({id: "B", type: "Thing", name: "B"});
    model.createRelationship({type: AGGREGATES, relatingObjectId: "A", relatedObjectId: "B"});
    model.createRelationship({type: AGGREGATES, relatingObjectId: "B", relatedObjectId: "A"});

    const resultObjectIds: string[] = [];
    const result = searchObjects(data, {startObjectId: "A", resultObjectIds});

    expect(result.ok).toBe(true);
    expect(resultObjectIds).toEqual(["A", "B"]);
  });

  it("filters the result set by object type via includeObjects", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    // includeObjects restricts which visited objects land in the result, but
    // traversal still walks through the excluded intermediate objects.
    searchObjects(data, {startObjectId: "Building", includeObjects: ["IfcWall"], resultObjectIds});

    expect(resultObjectIds).toEqual(["Wall1", "Wall2"]);
  });

  it("filters the result set by object type via excludeObjects", () => {
    const data = buildData();
    const resultObjectIds: string[] = [];

    searchObjects(data, {startObjectId: "Building", excludeObjects: ["IfcWall"], resultObjectIds});

    expect(resultObjectIds).toEqual(["Building", "Storey1", "Storey2"]);
  });

  // include/excludeRelating filter by RELATIONSHIP type (the type passed to
  // createRelationship), not by any object's type. This little graph mixes two
  // relationship types out of a single root so the filters are observable:
  //
  //   A --aggregates--> B
  //   A --references--> C
  function buildMixedRelData() {
    const data = new Data();
    const model = data.createModel({id: "mixed"}).value!;
    for (const id of ["A", "B", "C"]) {
      expect(model.createObject({id, type: "Thing", name: id}).ok).toBe(true);
    }
    expect(model.createRelationship({type: "aggregates", relatingObjectId: "A", relatedObjectId: "B"}).ok).toBe(true);
    expect(model.createRelationship({type: "references", relatingObjectId: "A", relatedObjectId: "C"}).ok).toBe(true);
    return data;
  }

  it("follows only the relationship types listed in includeRelating", () => {
    const data = buildMixedRelData();
    const resultObjectIds: string[] = [];

    // Only 'aggregates' edges are descended, so B is reached but C (via
    // 'references') is not.
    searchObjects(data, {startObjectId: "A", includeRelating: ["aggregates"], resultObjectIds});

    expect(resultObjectIds).toEqual(["A", "B"]);
  });

  it("follows only the relationship types listed in includeRelated", () => {
    const data = buildMixedRelData();
    const resultObjectIds: string[] = [];

    searchObjects(data, {startObjectId: "A", includeRelated: ["aggregates"], resultObjectIds});

    expect(resultObjectIds).toEqual(["A", "B"]);
  });

  it("skips the relationship types listed in excludeRelating", () => {
    const data = buildMixedRelData();
    const resultObjectIds: string[] = [];

    // 'references' edges are skipped; 'aggregates' is still followed.
    searchObjects(data, {startObjectId: "A", excludeRelating: ["references"], resultObjectIds});

    expect(resultObjectIds).toEqual(["A", "B"]);
  });

  it("skips the relationship types listed in excludeRelated", () => {
    const data = buildMixedRelData();
    const resultObjectIds: string[] = [];

    searchObjects(data, {startObjectId: "A", excludeRelated: ["references"], resultObjectIds});

    expect(resultObjectIds).toEqual(["A", "B"]);
  });

  it("descends no relationships when includeRelating lists only unused types", () => {
    const data = buildMixedRelData();
    const resultObjectIds: string[] = [];

    searchObjects(data, {startObjectId: "A", includeRelating: ["noSuchType"], resultObjectIds});

    expect(resultObjectIds).toEqual(["A"]);
  });

  it("returns InvalidInput when the start object is not in the Data", () => {
    const data = buildData();
    const result = searchObjects(data, {startObjectId: "DoesNotExist", resultObjectIds: []});
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.type).toBe(SDKErrorType.InvalidInput);
    }
  });

  it("returns InvalidOperation when the Data has been destroyed (the destroyed guard)", () => {
    const data = buildData();
    data.destroyed = true;   // the source short-circuits on data.destroyed

    const result = searchObjects(data, {startObjectId: "Building", resultObjectIds: []});

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.type).toBe(SDKErrorType.InvalidOperation);
      expect(result.error).toMatch(/already destroyed/);
    }
  });
});
