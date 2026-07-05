import {getElementCssSize} from "../getElementCssSize";

describe("getElementCssSize", () => {
  test("prefers bounding-client-rect dimensions", () => {
    const element = {
      getBoundingClientRect: () => ({width: 123.5, height: 45.25}),
      clientWidth: 100,
      clientHeight: 40,
      offsetWidth: 90,
      offsetHeight: 30,
    } as HTMLElement;

    expect(getElementCssSize(element)).toEqual({width: 123.5, height: 45.25});
  });

  test("falls back to layout dimensions when the rect is empty", () => {
    const element = {
      getBoundingClientRect: () => ({width: 0, height: 0}),
      clientWidth: 100,
      clientHeight: 40,
      offsetWidth: 90,
      offsetHeight: 30,
    } as HTMLElement;

    expect(getElementCssSize(element)).toEqual({width: 100, height: 40});
  });
});
