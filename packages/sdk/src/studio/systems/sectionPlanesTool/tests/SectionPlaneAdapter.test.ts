import type {Vec3} from "../../../../base/math/vector";
import {SectionPlaneAdapter} from "../SectionPlaneAdapter";

class FakeSectionPlane {
  destroyed = false;
  private _pos: Vec3;
  private _dir: Vec3;

  constructor(pos: Vec3, dir: Vec3) {
    this._pos = pos;
    this._dir = dir;
  }

  get pos(): Vec3 {
    return this._pos;
  }

  set pos(value: Vec3) {
    this._pos = value;
  }

  get dir(): Vec3 {
    return this._dir;
  }

  set dir(value: Vec3) {
    this._dir = value;
  }
}

const round = (v: ArrayLike<number>) => Array.from(v).map((n) => +n.toFixed(6));

describe("SectionPlaneAdapter", () => {
  it("drops tangent translation so the proxy stays on the rendered plane", () => {
    const plane = new FakeSectionPlane([1, 2, 3], [0, 0, 1]);
    const adapter = new SectionPlaneAdapter(plane as any);
    const matrix = adapter.getMatrix();

    matrix[12] += 5;
    adapter.setMatrix(matrix);

    expect(round(plane.pos)).toEqual([1, 2, 3]);
    expect(round(plane.dir)).toEqual([0, 0, 1]);
  });

  it("keeps normal translation", () => {
    const plane = new FakeSectionPlane([1, 2, 3], [0, 0, 1]);
    const adapter = new SectionPlaneAdapter(plane as any);
    const matrix = adapter.getMatrix();

    matrix[14] += 2;
    adapter.setMatrix(matrix);

    expect(round(plane.pos)).toEqual([1, 2, 5]);
    expect(round(plane.dir)).toEqual([0, 0, 1]);
  });

  it("updates the direction from the matrix normal", () => {
    const plane = new FakeSectionPlane([1, 2, 3], [0, 0, 1]);
    const adapter = new SectionPlaneAdapter(plane as any);
    const matrix = adapter.getMatrix();
    matrix[8] = 0;
    matrix[9] = 2;
    matrix[10] = 0;

    adapter.setMatrix(matrix);

    expect(round(plane.pos)).toEqual([1, 2, 3]);
    expect(round(plane.dir)).toEqual([0, 1, 0]);
  });
});
