import {LODVisibility} from "../index";

describe("LODVisibility", () => {
  it("tracks per-view suppression without mutating application visibility", () => {
    const visibility = new LODVisibility();

    expect(visibility.getViewVersion("view")).toBe(0);
    expect(visibility.setSuppressed("view", ["a", "b"], true)).toBe(true);
    expect(visibility.isSuppressed("view", "a")).toBe(true);
    expect(visibility.isSuppressed("other", "a")).toBe(false);
    expect(visibility.getViewVersion("view")).toBe(1);
    expect(visibility.setSuppressed("view", ["a"], true)).toBe(false);
    expect(visibility.setSuppressed("view", ["a"], false)).toBe(true);
    expect(visibility.isSuppressed("view", "a")).toBe(false);
    expect(visibility.isSuppressed("view", "b")).toBe(true);
    expect(visibility.getViewVersion("view")).toBe(2);
  });

  it("notifies only when suppression changes", () => {
    const onChanged = jest.fn();
    const visibility = new LODVisibility(onChanged);

    expect(visibility.setSuppressed("view", ["a"], false)).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();

    expect(visibility.setSuppressed("view", ["a"], true)).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenLastCalledWith("view");

    expect(visibility.setSuppressed("view", ["a"], true)).toBe(false);
    expect(onChanged).toHaveBeenCalledTimes(1);

    expect(visibility.setSuppressed("view", ["a"], false)).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenLastCalledWith("view");
  });

  it("selects representation membership without rewriting explicit suppression sets", () => {
    const onChanged = jest.fn();
    const visibility = new LODVisibility(onChanged);
    const reps = [
      {id: "detailed", objectIds: ["wall", "slab", "duct"]},
      {id: "dominant", objectIds: ["wall"]},
      {id: "shell", objectIds: ["shell"]}
    ];

    expect(visibility.setSelectedRep("view", "floor3", reps, "detailed")).toBe(true);
    expect(visibility.isSuppressed("view", "wall")).toBe(false);
    expect(visibility.isSuppressed("view", "slab")).toBe(false);
    expect(visibility.isSuppressed("view", "duct")).toBe(false);
    expect(visibility.isSuppressed("view", "shell")).toBe(true);
    expect(visibility.getViewVersion("view")).toBe(1);

    expect(visibility.setSelectedRep("view", "floor3", reps, "dominant")).toBe(true);
    expect(visibility.isSuppressed("view", "wall")).toBe(false);
    expect(visibility.isSuppressed("view", "slab")).toBe(true);
    expect(visibility.isSuppressed("view", "duct")).toBe(true);
    expect(visibility.isSuppressed("view", "shell")).toBe(true);
    expect(visibility.getViewVersion("view")).toBe(2);

    expect(visibility.setSelectedRep("view", "floor3", reps, "dominant")).toBe(false);
    expect(visibility.getViewVersion("view")).toBe(2);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("does not report object-level suppression deltas for representation switches", () => {
    const visibility = new LODVisibility();
    const reps = [
      {id: "detailed", objectIds: ["wall", "slab", "duct"]},
      {id: "dominant", objectIds: ["wall"]},
      {id: "shell", objectIds: ["shell"]}
    ];

    visibility.setSelectedRep("view", "floor3", reps, "detailed");
    expect(visibility.getSuppressionDeltasSince("view", 0)).toEqual({
      fromVersion: 0,
      toVersion: 1,
      deltas: []
    });

    visibility.setSelectedRep("view", "floor3", reps, "dominant");
    expect(visibility.getSuppressionDeltasSince("view", 1)).toEqual({
      fromVersion: 1,
      toVersion: 2,
      deltas: []
    });

    visibility.setSelectedRep("view", "floor3", reps, "shell");
    expect(visibility.getSuppressionDeltasSince("view", 2)).toEqual({
      fromVersion: 2,
      toVersion: 3,
      deltas: []
    });
  });

  it("separates representation signatures from explicit object suppression versions", () => {
    const visibility = new LODVisibility();
    const reps = [
      {id: "detailed", objectIds: ["wall", "slab"]},
      {id: "dominant", objectIds: ["wall"]}
    ];

    expect(visibility.getObjectSuppressionVersion("view")).toBe(0);
    expect(visibility.getRepSelectionSignature("view")).toBe("");

    visibility.setSelectedRep("view", "model:floor3", reps, "detailed");
    expect(visibility.getViewVersion("view")).toBe(1);
    expect(visibility.getObjectSuppressionVersion("view")).toBe(0);
    expect(visibility.getRepSelectionSignature("view")).toBe("model:floor3:detailed");

    visibility.setSelectedRep("view", "model:floor3", reps, "dominant");
    expect(visibility.getViewVersion("view")).toBe(2);
    expect(visibility.getObjectSuppressionVersion("view")).toBe(0);
    expect(visibility.getRepSelectionSignature("view")).toBe("model:floor3:dominant");

    visibility.setSuppressed("view", ["hidden"], true);
    expect(visibility.getViewVersion("view")).toBe(3);
    expect(visibility.getObjectSuppressionVersion("view")).toBe(1);
    expect(visibility.getRepSelectionSignature("view")).toBe("model:floor3:dominant");
  });

  it("keeps explicit suppression independent when it overlaps LOD selection", () => {
    const visibility = new LODVisibility();
    const reps = [
      {id: "detailed", objectIds: ["a", "b"]},
      {id: "shell", objectIds: ["shell"]}
    ];

    visibility.setSuppressed("view", ["a"], true);
    visibility.setSelectedRep("view", "set", reps, "shell");

    expect(visibility.isSuppressed("view", "a")).toBe(true);
    expect(visibility.getSuppressionDeltasSince("view", 1)).toEqual({
      fromVersion: 1,
      toVersion: 2,
      deltas: []
    });
  });

  it("tests batch representation membership directly", () => {
    const visibility = new LODVisibility();
    const reps = [
      {id: "detailed", objectIds: ["a", "b"]},
      {id: "dominant", objectIds: ["a"]}
    ];

    visibility.setSelectedRep("view", "model:set", reps, "dominant");

    expect(visibility.isRepMembershipSuppressed("view", [
      {selectionId: "model:set", repIds: ["detailed", "dominant"]}
    ])).toBe(false);
    expect(visibility.isRepMembershipSuppressed("view", [
      {selectionId: "model:set", repIds: ["detailed"]}
    ])).toBe(true);
    expect(visibility.isRepMembershipSuppressed("other", [
      {selectionId: "model:set", repIds: ["detailed"]}
    ])).toBe(false);
  });

  it("clears representation selections independently from explicit suppression", () => {
    const visibility = new LODVisibility();
    const reps = [
      {id: "detailed", objectIds: ["a", "b"]},
      {id: "shell", objectIds: ["shell"]}
    ];

    visibility.setSuppressed("view", ["hidden"], true);
    visibility.setSelectedRep("view", "set", reps, "shell");
    expect(visibility.isSuppressed("view", "a")).toBe(true);
    expect(visibility.isSuppressed("view", "shell")).toBe(false);
    expect(visibility.isSuppressed("view", "hidden")).toBe(true);

    expect(visibility.clearSelectedRep("view", "set")).toBe(true);
    expect(visibility.isSuppressed("view", "a")).toBe(false);
    expect(visibility.isSuppressed("view", "shell")).toBe(false);
    expect(visibility.isSuppressed("view", "hidden")).toBe(true);
    expect(visibility.clearSelectedRep("view", "set")).toBe(false);
  });
});
