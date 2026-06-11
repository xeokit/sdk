// Break the base/math barrel circular-import (pre-existing TDZ landmine)
// by stubbing the handler/animation modules ViewController pulls in — we
// only need the keyMap setter, which touches none of them.
jest.mock("../../cameraFlight", () => ({CameraFlightAnimation: class {}}));
jest.mock("../CameraUpdater", () => ({CameraUpdater: class {}}));
jest.mock("../PivotController", () => ({PivotController: class {}}));
jest.mock("../PanController", () => ({PanController: class {}}));
jest.mock("../PickController", () => ({PickController: class {}}));

import {ViewController} from "../ViewController";
import {QWERTYLayout, AZERTYLayout} from "../../../base/constants";
import {KEY_A, KEY_Q} from "../keycodes";

// Exercise the keyMap setter/getter in isolation (constructing a full
// ViewController needs a live View/Viewer). The setter only touches
// `this._keyMap` and reads static + module constants, so we can apply it
// to a bare probe object via the prototype property descriptor.
const desc = Object.getOwnPropertyDescriptor(ViewController.prototype, "keyMap")!;

function applyKeyMap(value: any): any {
  const probe: any = {};
  desc.set!.call(probe, value);
  return probe._keyMap;
}

describe("ViewController.keyMap", () => {
  it("builds a real action→keys map by default (QWERTY)", () => {
    const map = applyKeyMap(undefined);
    // Regression: previously this became the raw number 800001, so every
    // _isKeyDownForAction lookup returned undefined and NO key worked.
    expect(typeof map).toBe("object");
    expect(map[ViewController.PAN_LEFT]).toEqual([KEY_A]);
    expect(Array.isArray(map[ViewController.DOLLY_FORWARDS])).toBe(true);
  });

  it("honours the numeric QWERTYLayout / AZERTYLayout constants", () => {
    expect(applyKeyMap(QWERTYLayout)[ViewController.PAN_LEFT]).toEqual([KEY_A]);
    expect(applyKeyMap(AZERTYLayout)[ViewController.PAN_LEFT]).toEqual([KEY_Q]);
  });

  it("still accepts the legacy 'qwerty' / 'azerty' strings", () => {
    expect(applyKeyMap("qwerty")[ViewController.PAN_LEFT]).toEqual([KEY_A]);
    expect(applyKeyMap("azerty")[ViewController.PAN_LEFT]).toEqual([KEY_Q]);
  });

  it("passes through a custom mapping object unchanged", () => {
    const custom = {[ViewController.PAN_LEFT]: [KEY_Q]};
    expect(applyKeyMap(custom)).toBe(custom);
  });
});
