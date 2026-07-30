import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../base/constants";

let restoreDOMParser: (() => void) | null = null;

beforeAll(async () => {
  if (typeof DOMParser !== "undefined") {
    return;
  }
  const {JSDOM} = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = (globalThis as any).document;
  const previousDOMParser = (globalThis as any).DOMParser;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).DOMParser = dom.window.DOMParser;
  restoreDOMParser = () => {
    if (previousDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      (globalThis as any).document = previousDocument;
    }
    if (previousDOMParser === undefined) {
      delete (globalThis as any).DOMParser;
    } else {
      (globalThis as any).DOMParser = previousDOMParser;
    }
    dom.window.close();
  };
});

afterAll(() => {
  restoreDOMParser?.();
});

// Quantise positions to uint16 the way SceneGeometry stores them — the inverse
// of the exporter's decompressPoint3WithAABB3.
function quantize(positions: number[], aabb: number[]): Uint16Array {
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const min = aabb[k], max = aabb[k + 3];
      q[i + k] = Math.round(((positions[i + k] - min) / (max - min)) * 65535);
    }
  }
  return q;
}

const IDENTITY = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];

// A unit quad (2 triangles) in the XY plane (Z = 0).
const QUAD_POSITIONS = [0, 0, 0,  10, 0, 0,  10, 10, 0,  0, 10, 0];
const QUAD_AABB = [0, 0, 0, 10, 10, 0];
const QUAD_TRI_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

// An open L-shaped run of two connected line segments.
const LINE_POSITIONS = [0, 0, 0,  10, 0, 0,  10, 10, 0];
const LINE_AABB = [0, 0, 0, 10, 10, 0];
const LINE_INDICES = new Uint32Array([0, 1, 1, 2]);

function geom(primitive: number, positions: number[], aabb: number[], indices?: Uint32Array) {
  return {
    id: "g1",
    primitive,
    positionsCompressed: quantize(positions, aabb),
    aabb,
    indices,
  };
}

// The SVG encoder reads the world matrix via getMeshWorldMatrix(), which walks
// `sceneMesh.matrix` (+ optional parentTransform chain) — so meshes carry
// `matrix`, not `worldMatrix`.
function buildModel(g: any, color: number[], matrix = IDENTITY) {
  const mesh = {id: "mesh1", geometry: g, color, matrix};
  const sceneModel: any = {
    id: "sm",
    scene: {coordinateSystem: {}},
    objects: {Object1: {id: "Object1", meshes: [mesh]}},
  };
  return {sceneModel, mesh};
}

describe("SVGExporter encode", () => {

  it("wraps triangle meshes as <polygon> inside a well-formed SVG document", async () => {
    const {sceneModel} = buildModel(geom(TrianglesPrimitive, QUAD_POSITIONS, QUAD_AABB, QUAD_TRI_INDICES), [0.2, 0.4, 0.6]);

    const svg = await encode({sceneModel} as any);

    // Well-formed document scaffolding.
    expect(svg).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg"`);
    expect(svg).toMatch(/viewBox="[-\d. ]+"/);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    // Per-SceneObject <g id="..."> wrapper.
    expect(svg).toContain(`<g id="Object1">`);

    // 2 triangles → 2 <polygon> elements, each with 3 "x,y" point pairs.
    const polygons = svg.match(/<polygon [^>]*\/>/g) || [];
    expect(polygons).toHaveLength(2);
    for (const p of polygons) {
      const pts = /points="([^"]+)"/.exec(p)![1].trim().split(/\s+/);
      expect(pts).toHaveLength(3);
    }
    // Per-mesh colour folded into both stroke and fill (rgb 0..255).
    expect(svg).toContain(`fill="rgb(51,102,153)"`);
    expect(svg).toContain(`stroke="rgb(51,102,153)"`);
  });

  it("emits one <line> per index pair for line meshes", async () => {
    const {sceneModel} = buildModel(geom(LinesPrimitive, LINE_POSITIONS, LINE_AABB, LINE_INDICES), [1, 0, 0]);

    const svg = await encode({sceneModel} as any);

    const lines = svg.match(/<line [^>]*\/>/g) || [];
    expect(lines).toHaveLength(2);                       // two index pairs, no coalescing by default
    expect(svg).not.toContain("<polyline");
    expect(svg).toContain(`stroke="rgb(255,0,0)"`);
    expect(svg).toContain(`fill="none"`);                // lines are never filled
    // Each <line> carries the four endpoint coordinates.
    for (const l of lines) {
      expect(l).toMatch(/x1="[-\d.]+" y1="[-\d.]+" x2="[-\d.]+" y2="[-\d.]+"/);
    }
  });

  it("coalesces a connected line run into a single <polyline> when asked", async () => {
    const {sceneModel} = buildModel(geom(LinesPrimitive, LINE_POSITIONS, LINE_AABB, LINE_INDICES), [0, 0, 1]);

    const svg = await encode({sceneModel} as any, {coalescePolylines: true});

    const polylines = svg.match(/<polyline [^>]*\/>/g) || [];
    expect(polylines).toHaveLength(1);                   // the two shared-endpoint segments merge
    expect(svg).not.toMatch(/<line /);
    // Coalesced run of 3 connected points.
    const pts = /points="([^"]+)"/.exec(polylines[0])![1].trim().split(/\s+/);
    expect(pts).toHaveLength(3);
  });

  it("emits one <circle> per vertex for point meshes", async () => {
    const {sceneModel} = buildModel(geom(PointsPrimitive, LINE_POSITIONS, LINE_AABB), [0, 1, 0]);

    const svg = await encode({sceneModel} as any);

    const circles = svg.match(/<circle [^>]*\/>/g) || [];
    expect(circles).toHaveLength(3);                     // three vertices
    expect(circles[0]).toMatch(/cx="[-\d.]+" cy="[-\d.]+" r="[-\d.]+"/);
    expect(svg).toContain(`fill="rgb(0,255,0)"`);        // points fill with the stroke colour
  });

  it("honours stroke/fill overrides, background, and explicit width/height", async () => {
    const {sceneModel} = buildModel(geom(TrianglesPrimitive, QUAD_POSITIONS, QUAD_AABB, QUAD_TRI_INDICES), [0.2, 0.4, 0.6]);

    const svg = await encode({sceneModel} as any, {
      strokeColor: [0, 0, 0],
      fillColor: "none",
      backgroundColor: [1, 1, 1],
      width: "800",
      height: "600",
    });

    expect(svg).toContain(`width="800" height="600"`);
    expect(svg).toContain(`<rect`);                      // background rect emitted
    expect(svg).toContain(`fill="rgb(255,255,255)"`);    // ...with the background colour
    expect(svg).toContain(`stroke="rgb(0,0,0)"`);        // stroke override
    // Every polygon suppresses its fill.
    for (const p of svg.match(/<polygon [^>]*\/>/g) || []) {
      expect(p).toContain(`fill="none"`);
    }
  });

  it("bakes the mesh world matrix into projected coordinates", async () => {
    const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  100, 200, 0, 1];
    const {sceneModel} = buildModel(geom(LinesPrimitive, LINE_POSITIONS, LINE_AABB, LINE_INDICES), [0, 0, 0], matrix);

    const svg = await encode({sceneModel} as any, {flipY: false, padding: 0});

    // viewBox minimum should sit at the translated origin (100, 200) within
    // ~1mm of the uint16 quantisation, proving the matrix was folded in.
    const vb = /viewBox="([-\d. ]+)"/.exec(svg)![1].split(/\s+/).map(Number);
    expect(vb[0]).toBeCloseTo(100, 1);
    expect(vb[1]).toBeCloseTo(200, 1);
  });

  it("still emits a well-formed empty SVG for a model with no geometry", async () => {
    const sceneModel: any = {id: "sm", scene: {coordinateSystem: {}}, objects: {}};

    const svg = await encode({sceneModel} as any);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).not.toMatch(/<(polygon|line|polyline|circle)\b/);
  });

  it("throws when no SceneModel is supplied", async () => {
    await expect(encode({} as any)).rejects.toThrow(/sceneModel is required/);
  });
});

describe("SVGExporter → SVGLoader round-trip", () => {

  it("re-imports exported <line> geometry back through parse", async () => {
    const {sceneModel} = buildModel(geom(LinesPrimitive, LINE_POSITIONS, LINE_AABB, LINE_INDICES), [1, 0, 0]);

    // flipY:false keeps coordinates in their natural orientation; the loader
    // applies its own flip from the SVG height, but for an assertion on counts
    // + colour the orientation is irrelevant.
    const svg = await encode({sceneModel} as any);

    const calls: {geom: any[]; mesh: any[]; material: any[]; object: any[]} =
      {geom: [], mesh: [], material: [], object: []};
    const dst: any = {
      id: "dst",
      destroyed: false,
      createGeometry: (p: any) => { calls.geom.push(p);     return {ok: true, value: {}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);     return {ok: true, value: {}}; },
      createMaterial: (p: any) => { calls.material.push(p); return {ok: true, value: {}}; },
      createObject:   (p: any) => { calls.object.push(p);   return {ok: true, value: {}}; },
    };

    const res: any = await parse({fileData: svg, sceneModel: dst});
    expect(res.ok).toBe(true);

    // Strokes come back as a single Lines geometry carrying both segments.
    expect(calls.geom).toHaveLength(1);
    expect(calls.geom[0].primitive).toBe(LinesPrimitive);
    // 2 segments × 2 vertices × 3 components.
    expect(calls.geom[0].positions).toHaveLength(12);

    // Colour survived the round-trip onto the loader's material.
    expect(calls.material).toHaveLength(1);
    expect(calls.material[0].color.map((v: number) => +v.toFixed(2))).toEqual([1, 0, 0]);

    // One SceneObject wrapping the stroke mesh.
    expect(calls.object).toHaveLength(1);
    expect(calls.mesh).toHaveLength(1);
  });

  it("rejects parse input with no DOMParser-parseable SVG", async () => {
    const dst: any = {id: "dst", destroyed: false};
    const res: any = await parse({fileData: "", sceneModel: dst});
    expect(res.ok).toBe(false);
  });
});
