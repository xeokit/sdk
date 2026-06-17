/**
 * Parses a 3DXML tessellated representation document (`.3DRep` /
 * `XMLRepresentation`) into triangle geometry.
 *
 * Geometry lives in `<Rep>` elements (a Rep may nest child Reps — a "bag"):
 *   - `<VertexBuffer>` → `<Positions>` (and optional `<Normals>`) as flat
 *     number lists (whitespace/comma/`;` separated).
 *   - `<Faces>` → `<Face triangles="i j k …">` — a triangle soup of indices into
 *     the VertexBuffer.
 *   - `<SurfaceAttributes>` → `<Color red green blue alpha>` (0–1) for a flat
 *     per-Rep colour.
 *
 * One geometry is produced per Rep that owns a VertexBuffer. v1 reads the
 * `triangles` index list only — `strips` / `fans` and exact B-rep are out of
 * scope.
 *
 * @internal
 */
import {descendants, numbersIn} from "./xml";

/** A single tessellated mesh extracted from a representation document. */
export interface RepGeometry {
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
  color?: [number, number, number, number];
}

export function parseRepresentation(doc: Document): RepGeometry[] {
  const out: RepGeometry[] = [];

  // Group each VertexBuffer/Faces/Color under its nearest enclosing <Rep> so
  // nested "bag" Reps don't bleed geometry into one another.
  for (const rep of descendants(doc, "Rep")) {
    const vb = nearestOwned(rep, "VertexBuffer");
    if (!vb) {
      continue;   // a grouping Rep with no geometry of its own
    }

    const positions = floats(textOfChild(vb, "Positions"));
    if (positions.length < 9) {
      continue;   // need at least one triangle's worth of vertices
    }
    const vertexCount = (positions.length / 3) | 0;

    const normalsRaw = floats(textOfChild(vb, "Normals"));
    const normals = normalsRaw.length === positions.length ? normalsRaw : undefined;

    const indices: number[] = [];
    for (const face of descendants(rep, "Face")) {
      if (nearestRep(face) !== rep) {
        continue;
      }
      const tri = face.getAttribute("triangles");
      if (!tri) {
        continue;   // strips / fans not handled in v1
      }
      const idx = numbersIn(tri);
      // Whole triangles only, and drop any index out of range (corrupt face).
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const a = idx[i] | 0, b = idx[i + 1] | 0, c = idx[i + 2] | 0;
        if (a < vertexCount && b < vertexCount && c < vertexCount && a >= 0 && b >= 0 && c >= 0) {
          indices.push(a, b, c);
        }
      }
    }
    if (indices.length === 0) {
      continue;
    }

    out.push({
      positions,
      normals,
      indices: new Uint32Array(indices),
      color: repColor(rep),
    });
  }

  return out;
}

/** First descendant `localName` whose nearest enclosing Rep is `rep` (its own, not a child Rep's). */
function nearestOwned(rep: Element, localName: string): Element | null {
  for (const el of descendants(rep, localName)) {
    if (nearestRep(el) === rep) {
      return el;
    }
  }
  return null;
}

/** Closest ancestor `<Rep>` of an element (or null). */
function nearestRep(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.localName === "Rep") {
      return p;
    }
  }
  return null;
}

function textOfChild(parent: Element, localName: string): string | null {
  return descendants(parent, localName)[0]?.textContent ?? null;
}

function floats(text: string | null): Float32Array {
  return Float32Array.from(numbersIn(text));
}

/** Flat RGBA from this Rep's own `<Color>` (0–1); undefined if none. */
function repColor(rep: Element): [number, number, number, number] | undefined {
  let color: Element | null = null;
  for (const c of descendants(rep, "Color")) {
    if (nearestRep(c) === rep) {
      color = c;
      break;
    }
  }
  if (!color) {
    return undefined;
  }
  const r = num(color, "red"), g = num(color, "green"), b = num(color, "blue");
  if (r == null || g == null || b == null) {
    return undefined;
  }
  const a = num(color, "alpha");
  return [r, g, b, a == null ? 1 : a];
}

function num(el: Element, attr: string): number | null {
  const v = el.getAttribute(attr);
  if (v == null || v === "") {
    return null;
  }
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
