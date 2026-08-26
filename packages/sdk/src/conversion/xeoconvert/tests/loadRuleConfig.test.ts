import {InspectionRegistry, FixRegistry} from "../../../quality/sceneModel";
import {
  applyRuleConfig, applyInspectionConfig, applyOptimizationConfig, serializeRuleConfig,
  type RuleRegistries,
} from "../loadRuleConfig";

function freshRegistries(): RuleRegistries {
  const inspections = new InspectionRegistry([
    {codes: ["denseGeometries"], description: "dense", run: () => []} as any,
  ]);
  const optimizations = new FixRegistry([
    {codes: ["GEOMETRY_DUPLICATE"], description: "dedup", apply: () => ({ok: true, value: {fixed: true}})} as any,
  ]);
  return {inspections, optimizations};
}

describe("loadRuleConfig (xeoconvert --config / --inspect-config / --optimize-config)", () => {

  it("applies inspection + optimization overrides into the registries", () => {
    const r = freshRegistries();
    applyRuleConfig({
      sceneInspections: {denseGeometries: {enabled: true, maxVertices: 50000}},
      optimizations: {GEOMETRY_DUPLICATE: {enabled: false}},
    }, {registries: r});

    expect(r.inspections.serializeConfigs().denseGeometries).toEqual({enabled: true, maxVertices: 50000});
    expect(r.optimizations.serializeConfigs().GEOMETRY_DUPLICATE).toEqual({enabled: false});
  });

  it("applies inspection-only / optimization-only blobs", () => {
    const r = freshRegistries();
    applyInspectionConfig({denseGeometries: {maxVertices: 123}}, r);
    applyOptimizationConfig({GEOMETRY_DUPLICATE: {enabled: false}}, r);
    expect(r.inspections.serializeConfigs().denseGeometries).toEqual({maxVertices: 123});
    expect(r.optimizations.serializeConfigs().GEOMETRY_DUPLICATE).toEqual({enabled: false});
  });

  it("loads custom rules from a plugin's register(registries)", () => {
    const r = freshRegistries();
    const fakeRequire = (id: string) => {
      expect(id).toContain("my-rules"); // relative spec resolved against baseDir
      return {
        register(reg: RuleRegistries) {
          reg.inspections.register({codes: ["MyApp/NAMING"], description: "x", run: () => []} as any);
          reg.optimizations.register({codes: ["MyApp/FIX"], description: "y", apply: () => ({ok: true, value: {fixed: true}})} as any);
        },
      };
    };
    applyRuleConfig({plugins: ["./my-rules.cjs"]}, {registries: r, baseDir: "/tmp/cfg", requireModule: fakeRequire});
    expect(r.inspections.has("MyApp/NAMING")).toBe(true);
    expect(r.optimizations.has("MyApp/FIX")).toBe(true);
  });

  it("accepts a plugin exposed via module.default.register", () => {
    const r = freshRegistries();
    const fakeRequire = () => ({default: {register: (reg: RuleRegistries) => reg.inspections.register({codes: ["P"], description: "", run: () => []} as any)}});
    applyRuleConfig({plugins: ["pkg"]}, {registries: r, requireModule: fakeRequire});
    expect(r.inspections.has("P")).toBe(true);
  });

  it("throws if a plugin has no register() function", () => {
    const r = freshRegistries();
    expect(() => applyRuleConfig({plugins: ["bad"]}, {registries: r, requireModule: () => ({})}))
      .toThrow(/register\(registries\)/);
  });

  it("throws if plugins are present but no requireModule supplied", () => {
    const r = freshRegistries();
    expect(() => applyRuleConfig({plugins: ["x"]}, {registries: r})).toThrow(/requireModule/);
  });

  it("ignores empty/missing sections and passes dataInspections through", () => {
    const r = freshRegistries();
    const cfg = applyRuleConfig({dataInspections: {checkRelationshipCycles: true}}, {registries: r});
    expect(cfg.dataInspections).toEqual({checkRelationshipCycles: true}); // returned for a later phase
  });

  it("serializeRuleConfig round-trips an applied config", () => {
    const r = freshRegistries();
    const blob = {sceneInspections: {denseGeometries: {enabled: true}}, optimizations: {GEOMETRY_DUPLICATE: {enabled: true}}};
    applyRuleConfig(blob, {registries: r});
    const out = serializeRuleConfig(r);
    expect(out.sceneInspections!.denseGeometries).toEqual({enabled: true});
    expect(out.optimizations!.GEOMETRY_DUPLICATE).toEqual({enabled: true});
  });
});
