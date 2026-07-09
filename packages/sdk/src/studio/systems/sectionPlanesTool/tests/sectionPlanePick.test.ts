import {sectionPlaneDirFromPickedNormal} from "../sectionPlanePick";

describe("sectionPlaneDirFromPickedNormal", () => {
  it("keeps normals that already face the camera side of the pick ray", () => {
    expect(sectionPlaneDirFromPickedNormal([0, 0, 1], [0, 0, -1])).toEqual([0, 0, 1]);
    expect(sectionPlaneDirFromPickedNormal([1, 0, 0], [-1, 0, 0])).toEqual([1, 0, 0]);
  });

  it("flips normals that point along the pick ray", () => {
    expect(sectionPlaneDirFromPickedNormal([0, 0, -1], [0, 0, -1])).toEqual([0, 0, 1]);
    expect(sectionPlaneDirFromPickedNormal([-1, 0, 0], [-1, 0, 0])).toEqual([1, 0, 0]);
  });

  it("uses the normal as-is when no ray direction is available", () => {
    expect(sectionPlaneDirFromPickedNormal([0, 0, 1])).toEqual([0, 0, 1]);
    expect(sectionPlaneDirFromPickedNormal([1, -2, 3])).toEqual([1, -2, 3]);
  });

  it("keeps the legacy world-up fallback when no normal is available", () => {
    expect(sectionPlaneDirFromPickedNormal(null)).toEqual([0, 0, 1]);
    expect(sectionPlaneDirFromPickedNormal(undefined)).toEqual([0, 0, 1]);
  });
});
