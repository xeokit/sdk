import {SDKErrorType} from "../../../base/core";
import {ViewProfiles} from "../ViewProfiles";

class ProfileEffect {
  writes: Record<string, number> = {};
  private _enabled: boolean;
  private _intensity: number;
  private _exposure: number;

  constructor(params: {enabled?: boolean; intensity?: number; exposure?: number} = {}) {
    this._enabled = params.enabled !== undefined ? params.enabled : false;
    this._intensity = params.intensity !== undefined ? params.intensity : 1.0;
    this._exposure = params.exposure !== undefined ? params.exposure : 1.0;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this.writes.enabled = (this.writes.enabled || 0) + 1;
    this._enabled = value;
  }

  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    this.writes.intensity = (this.writes.intensity || 0) + 1;
    this._intensity = value;
  }

  get exposure(): number {
    return this._exposure;
  }

  set exposure(value: number) {
    this.writes.exposure = (this.writes.exposure || 0) + 1;
    this._exposure = value;
  }
}

function createView() {
  const effect = () => new ProfileEffect();
  const view: any = {
    viewer: {
      logError: (result: any) => result
    },
    needsRender: jest.fn(),
    effects: {
      sao: effect(),
      edges: effect(),
      bloom: effect(),
      atmosphere: effect(),
      depthOfField: effect(),
      colorGrading: effect(),
      tonemap: new ProfileEffect({exposure: 1.0}),
      antiAliasing: effect(),
      shadows: effect(),
      sky: effect(),
      sectionPlaneCaps: effect(),
      bodyHatch: effect()
    },
    lights: {
      ibl: new ProfileEffect({intensity: 1.0}),
      hemispheric: effect()
    },
    texturing: effect(),
    resolutionScale: effect()
  };
  return view;
}

describe("ViewProfiles", () => {
  test("applies closed-world enablement and restores underlying state when cleared", () => {
    const view = createView();
    view.lights.ibl.enabled = false;
    view.effects.sao.enabled = true;
    view.effects.atmosphere.enabled = true;
    view.effects.depthOfField.enabled = true;
    view.effects.tonemap.enabled = false;

    const profiles = new ViewProfiles(view, {
      profiles: {
        realistic: {
          ibl: {enabled: true, intensity: 0.4},
          toneMap: {enabled: true, exposure: 1.2},
          atmosphere: {enabled: true, intensity: 0.25},
          depthOfField: {enabled: true, intensity: 0.6},
          sao: {intensity: 0.5}
        }
      }
    });

    expect(profiles.setActiveProfile("realistic").ok).toBe(true);
    expect(view.lights.ibl.enabled).toBe(true);
    expect(view.effects.tonemap.enabled).toBe(true);
    expect(view.effects.sao.enabled).toBe(false);
    expect(view.effects.atmosphere.enabled).toBe(true);
    expect(view.effects.depthOfField.enabled).toBe(true);
    expect(view.lights.ibl.intensity).toBe(0.4);
    expect(view.effects.tonemap.exposure).toBe(1.2);
    expect(view.effects.atmosphere.intensity).toBe(0.25);
    expect(view.effects.depthOfField.intensity).toBe(0.6);

    expect(profiles.setActiveProfile(null).ok).toBe(true);
    expect(view.lights.ibl.enabled).toBe(false);
    expect(view.effects.sao.enabled).toBe(true);
    expect(view.effects.atmosphere.enabled).toBe(true);
    expect(view.effects.depthOfField.enabled).toBe(true);
    expect(view.effects.tonemap.enabled).toBe(false);
    expect(view.lights.ibl.intensity).toBe(1.0);
    expect(view.effects.tonemap.exposure).toBe(1.0);
    expect(view.effects.atmosphere.intensity).toBe(1.0);
    expect(view.effects.depthOfField.intensity).toBe(1.0);
  });

  test("transitions directly between profiles and avoids redundant writes", () => {
    const view = createView();
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {ibl: {enabled: true, intensity: 0.4}},
        b: {ibl: {enabled: true, intensity: 0.6}}
      }
    });

    expect(profiles.setActiveProfile("a").ok).toBe(true);
    view.lights.ibl.writes.intensity = 0;
    view.lights.ibl.writes.enabled = 0;

    expect(profiles.setActiveProfile("b").ok).toBe(true);
    expect(view.lights.ibl.intensity).toBe(0.6);
    expect(view.lights.ibl.enabled).toBe(true);
    expect(view.lights.ibl.writes.intensity).toBe(1);
    expect(view.lights.ibl.writes.enabled || 0).toBe(0);
  });

  test("setProperties supersedes profile state without mutating profile definitions", () => {
    const view = createView();
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {ibl: {enabled: true, intensity: 0.4}},
        b: {ibl: {enabled: true, intensity: 0.6}},
        c: {ibl: {enabled: true}}
      }
    });

    expect(profiles.setActiveProfile("a").ok).toBe(true);
    expect(profiles.setProperties({ibl: {enabled: false, intensity: 0.8}}).ok).toBe(true);
    expect(view.lights.ibl.enabled).toBe(false);
    expect(view.lights.ibl.intensity).toBe(0.8);
    expect(profiles.getProfile("a")!.ibl!.intensity).toBe(0.4);

    expect(profiles.setActiveProfile("b").ok).toBe(true);
    expect(view.lights.ibl.enabled).toBe(true);
    expect(view.lights.ibl.intensity).toBe(0.6);

    expect(profiles.setActiveProfile("c").ok).toBe(true);
    expect(view.lights.ibl.intensity).toBe(0.8);
  });

  test("active profile edits preserve unrelated overrides but reclaim edited paths", () => {
    const view = createView();
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {
          ibl: {enabled: true, intensity: 0.4},
          toneMap: {enabled: true, exposure: 1.2}
        }
      }
    });

    expect(profiles.setActiveProfile("a").ok).toBe(true);
    expect(profiles.setProperties({ibl: {intensity: 0.8}, toneMap: {exposure: 1.5}}).ok).toBe(true);

    expect(profiles.setProfile("a", {
      ibl: {enabled: true, intensity: 0.5},
      toneMap: {enabled: true, exposure: 1.2}
    }).ok).toBe(true);

    expect(view.lights.ibl.intensity).toBe(0.5);
    expect(view.effects.tonemap.exposure).toBe(1.5);
  });

  test("removing the active profile restores state and clears activeProfile", () => {
    const view = createView();
    view.effects.sao.enabled = true;
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {ibl: {enabled: true}}
      },
      activeProfile: "a"
    });

    expect(view.effects.sao.enabled).toBe(false);
    expect(profiles.removeProfile("a").ok).toBe(true);
    expect(profiles.activeProfile).toBe(null);
    expect(view.effects.sao.enabled).toBe(true);
  });

  test("validates a batch before mutating", () => {
    const view = createView();
    const profiles = new ViewProfiles(view);
    view.lights.ibl.intensity = 1.0;

    const result = profiles.setProperties({
      ibl: {intensity: 0.2},
      sao: {missing: true}
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.type).toBe(SDKErrorType.InvalidInput);
    }
    expect(view.lights.ibl.intensity).toBe(1.0);
  });

  test("accepts toneMap as an input alias but stores canonical tonemap", () => {
    const view = createView();
    const profiles = new ViewProfiles(view);

    expect(profiles.addProfile("a", {
      toneMap: {enabled: true, exposure: 1.4}
    }).ok).toBe(true);
    expect(profiles.setActiveProfile("a").ok).toBe(true);
    expect(view.effects.tonemap.enabled).toBe(true);
    expect(view.effects.tonemap.exposure).toBe(1.4);

    const stored = profiles.getProfile("a") as any;
    expect(stored.tonemap.exposure).toBe(1.4);
    expect(stored.toneMap).toBeUndefined();

    const params = profiles.toParams();
    expect(params.ok).toBe(true);
    if (params.ok) {
      expect((params.value.profiles!.a as any).tonemap.exposure).toBe(1.4);
      expect((params.value.profiles!.a as any).toneMap).toBeUndefined();
    }
  });

  test("rejects ambiguous tonemap aliases", () => {
    const view = createView();
    const profiles = new ViewProfiles(view);
    const result = profiles.addProfile("a", {
      tonemap: {enabled: true},
      toneMap: {enabled: false}
    } as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.type).toBe(SDKErrorType.InvalidInput);
    }
  });

  test("round-trips params without exposing mutable internal profiles", () => {
    const view = createView();
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {ibl: {enabled: true, intensity: 0.4}}
      },
      activeProfile: "a"
    });

    const params = profiles.toParams();
    expect(params.ok).toBe(true);
    if (!params.ok) return;

    params.value.profiles!.a.ibl!.intensity = 9.0;
    expect(profiles.getProfile("a")!.ibl!.intensity).toBe(0.4);

    const nextView = createView();
    const next = new ViewProfiles(nextView);
    expect(next.fromParams(params.value).ok).toBe(true);
    expect(next.activeProfile).toBe("a");
    expect(nextView.lights.ibl.intensity).toBe(9.0);
  });

  test("fromParams validation failure leaves the existing configuration unchanged", () => {
    const view = createView();
    const profiles = new ViewProfiles(view, {
      profiles: {
        a: {ibl: {enabled: true, intensity: 0.4}}
      },
      activeProfile: "a"
    });

    const result = profiles.fromParams({
      profiles: {
        b: {sao: {missing: true} as any}
      },
      activeProfile: "b"
    });

    expect(result.ok).toBe(false);
    expect(profiles.activeProfile).toBe("a");
    expect(profiles.hasProfile("a")).toBe(true);
    expect(profiles.hasProfile("b")).toBe(false);
    expect(view.lights.ibl.intensity).toBe(0.4);
  });
});
