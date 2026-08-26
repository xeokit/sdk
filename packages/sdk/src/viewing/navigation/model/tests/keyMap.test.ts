// Break the base/math barrel circular-import (pre-existing TDZ landmine)
// by stubbing the handler/animation modules ModelNavigationController pulls in — we
// only need the keyMap setter, which touches none of them.
jest.mock("../../../cameraFlight", () => ({CameraFlightAnimation: class {}}));
jest.mock("../internal/CameraUpdater", () => ({CameraUpdater: class {}}));
jest.mock("../internal/PivotController", () => ({PivotController: class {}}));
jest.mock("../internal/PanController", () => ({PanController: class {}}));
jest.mock("../internal/PickController", () => ({PickController: class {}}));

import {ModelNavigationController} from "../ModelNavigationController";
import {QWERTYLayout, AZERTYLayout} from "../../../../base/constants";
import {KEY_A, KEY_Q} from "../keycodes";

// Exercise the keyMap setter/getter in isolation (constructing a full
// ModelNavigationController needs a live View/Viewer). The setter only touches
// `this._keyMap` and reads static + module constants, so we can apply it
// to a bare probe object via the prototype property descriptor.
const desc = Object.getOwnPropertyDescriptor(ModelNavigationController.prototype, "keyMap")!;
const doublePickFlyToDesc = Object.getOwnPropertyDescriptor(ModelNavigationController.prototype, "doublePickFlyTo")!;

function applyKeyMap(value: any): any {
  const probe: any = {};
  desc.set!.call(probe, value);
  return probe._keyMap;
}

describe("ModelNavigationController.keyMap", () => {
  it("builds a real action→keys map by default (QWERTY)", () => {
    const map = applyKeyMap(undefined);
    // Regression: previously this became the raw number 800001, so every
    // _isKeyDownForAction lookup returned undefined and NO key worked.
    expect(typeof map).toBe("object");
    expect(map[ModelNavigationController.PAN_LEFT]).toEqual([KEY_A]);
    expect(Array.isArray(map[ModelNavigationController.DOLLY_FORWARDS])).toBe(true);
  });

  it("honours the numeric QWERTYLayout / AZERTYLayout constants", () => {
    expect(applyKeyMap(QWERTYLayout)[ModelNavigationController.PAN_LEFT]).toEqual([KEY_A]);
    expect(applyKeyMap(AZERTYLayout)[ModelNavigationController.PAN_LEFT]).toEqual([KEY_Q]);
  });

  it("still accepts the legacy 'qwerty' / 'azerty' strings", () => {
    expect(applyKeyMap("qwerty")[ModelNavigationController.PAN_LEFT]).toEqual([KEY_A]);
    expect(applyKeyMap("azerty")[ModelNavigationController.PAN_LEFT]).toEqual([KEY_Q]);
  });

  it("passes through a custom mapping object unchanged", () => {
    const custom = {[ModelNavigationController.PAN_LEFT]: [KEY_Q]};
    expect(applyKeyMap(custom)).toBe(custom);
  });
});

describe("ModelNavigationController.doublePickFlyTo", () => {
  it("only enables double-pick fly-to when explicitly true", () => {
    const probe: any = {_configs: {doublePickFlyTo: false}};

    doublePickFlyToDesc.set!.call(probe, undefined);
    expect(probe._configs.doublePickFlyTo).toBe(false);

    doublePickFlyToDesc.set!.call(probe, false);
    expect(probe._configs.doublePickFlyTo).toBe(false);

    doublePickFlyToDesc.set!.call(probe, true);
    expect(probe._configs.doublePickFlyTo).toBe(true);
  });
});
