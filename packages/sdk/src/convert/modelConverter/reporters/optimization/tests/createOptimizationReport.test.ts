import {createOptimizationReport} from "../createOptimizationReport";

// Minimal ApplyFixesResult shells. createOptimizationReport reads the array
// lengths and hands each result to applyFixesResultToJson, which serialises each
// outcome's `issue` — so outcomes carry a minimal valid Issue.
const emptyFix = () => ({fixed: [], skipped: [], errors: []} as any);
const outcome = (code: string) => ({issue: {severity: "warning", code, message: "m"}, strategy: "fix"});

describe("createOptimizationReport", () => {

  it("returns null when no inspection ran", () => {
    expect(createOptimizationReport({} as any)).toBeNull();
  });

  it("returns null when inspection ran but no SceneModel was fixed", () => {
    const result: any = {inspection: {bySceneModel: {m1: {sceneModel: "m1", report: {}, durationMs: 1}}}};
    expect(createOptimizationReport(result)).toBeNull();
  });

  it("summarises fix outcomes per SceneModel when optimization ran", () => {
    const result: any = {
      inspection: {
        bySceneModel: {
          m1: {sceneModel: "m1", fixResult: {fixed: [outcome("A"), outcome("B")], skipped: [outcome("C")], errors: []}, durationMs: 1},
          m2: {sceneModel: "m2", fixResult: emptyFix(), durationMs: 1},
        },
      },
    };
    const report: any = createOptimizationReport(result);
    expect(report).not.toBeNull();
    expect(report.counts.sceneModels).toBe(2);
    expect(report.counts.fixed).toBe(2);
    expect(report.counts.skipped).toBe(1);
    expect(report.counts.errors).toBe(0);
    expect(Object.keys(report.bySceneModel)).toEqual(["m1", "m2"]);
  });

  it("skips SceneModels that have no fixResult (inspect without fix)", () => {
    const result: any = {
      inspection: {
        bySceneModel: {
          m1: {sceneModel: "m1", fixResult: emptyFix(), durationMs: 1},
          m2: {sceneModel: "m2", report: {}, durationMs: 1}, // inspected, not fixed
        },
      },
    };
    const report: any = createOptimizationReport(result);
    expect(report.counts.sceneModels).toBe(1);
    expect(Object.keys(report.bySceneModel)).toEqual(["m1"]);
  });
});
