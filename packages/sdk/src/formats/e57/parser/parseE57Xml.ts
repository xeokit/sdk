import type {E57Document, E57Field, E57PointCloud, E57Pose, E57CartesianBounds} from "./types";

/**
 * Parses the E57 XML section into a typed {@link E57Document}.
 *
 * Uses the host `DOMParser` (native in browsers). Under Node — e.g. the
 * xeoconvert CLI — a `DOMParser` polyfill (`@xmldom/xmldom`, `linkedom`, …)
 * must be installed on `globalThis` first, the same requirement the 3DXML
 * loader carries. E57 declares a default namespace, so elements are matched by
 * local name throughout.
 */
export function parseE57Xml(xml: string): E57Document {
  if (typeof DOMParser === "undefined") {
    throw new Error("[parseE57Xml] no DOMParser available — install a DOMParser polyfill under Node");
  }
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (!root || localName(root) !== "e57Root") {
    throw new Error(`[parseE57Xml] expected <e57Root>, got <${root ? localName(root) : "null"}>`);
  }

  const pointClouds: E57PointCloud[] = [];
  const data3D = childByLocalName(root, "data3D");
  if (data3D) {
    for (const child of childrenByLocalName(data3D, "vectorChild")) {
      pointClouds.push(parsePointCloud(child));
    }
  }
  return {pointClouds};
}

function parsePointCloud(el: Element): E57PointCloud {
  const points = childByLocalName(el, "points");
  if (!points) {
    throw new Error("[parseE57Xml] data3D child has no <points> CompressedVector");
  }
  const fileOffset = intAttr(points, "fileOffset");
  const recordCount = intAttr(points, "recordCount");
  if (fileOffset === undefined || recordCount === undefined) {
    throw new Error("[parseE57Xml] <points> missing fileOffset / recordCount");
  }

  const protoEl = childByLocalName(points, "prototype");
  if (!protoEl) {
    throw new Error("[parseE57Xml] <points> has no <prototype>");
  }
  const prototype = childElements(protoEl).map(parseField);

  return {
    guid: textOf(childByLocalName(el, "guid")),
    name: textOf(childByLocalName(el, "name")),
    pose: parsePose(childByLocalName(el, "pose")),
    cartesianBounds: parseBounds(childByLocalName(el, "cartesianBounds")),
    prototype,
    recordCount,
    pointsFileOffset: fileOffset,
  };
}

function parseField(el: Element): E57Field {
  const type = el.getAttribute("type") as E57Field["type"];
  const precision = el.getAttribute("precision");
  return {
    name: localName(el),
    type,
    precision: precision === "single" || precision === "double" ? precision : undefined,
    minimum: floatAttr(el, "minimum") ?? 0,
    maximum: floatAttr(el, "maximum") ?? 0,
    scale: floatAttr(el, "scale") ?? 1,
    offset: floatAttr(el, "offset") ?? 0,
  };
}

function parsePose(el: Element | null): E57Pose | undefined {
  if (!el) return undefined;
  const rot = childByLocalName(el, "rotation");
  const trans = childByLocalName(el, "translation");
  if (!rot || !trans) return undefined;
  const f = (parent: Element, name: string) => floatText(childByLocalName(parent, name)) ?? 0;
  return {
    rotation: [f(rot, "w"), f(rot, "x"), f(rot, "y"), f(rot, "z")],
    translation: [f(trans, "x"), f(trans, "y"), f(trans, "z")],
  };
}

function parseBounds(el: Element | null): E57CartesianBounds | undefined {
  if (!el) return undefined;
  const f = (name: string) => floatText(childByLocalName(el, name)) ?? 0;
  return {
    xMinimum: f("xMinimum"), xMaximum: f("xMaximum"),
    yMinimum: f("yMinimum"), yMaximum: f("yMaximum"),
    zMinimum: f("zMinimum"), zMaximum: f("zMaximum"),
  };
}

// ── DOM helpers (local-name based, namespace-agnostic) ──────────────

function localName(el: Element): string {
  return el.localName || el.nodeName.replace(/^.*:/, "");
}

function childElements(parent: Element): Element[] {
  const out: Element[] = [];
  for (let n = parent.firstElementChild; n; n = n.nextElementSibling) out.push(n);
  return out;
}

function childByLocalName(parent: Element, name: string): Element | null {
  for (let n = parent.firstElementChild; n; n = n.nextElementSibling) {
    if (localName(n) === name) return n;
  }
  return null;
}

function childrenByLocalName(parent: Element, name: string): Element[] {
  return childElements(parent).filter(n => localName(n) === name);
}

function textOf(el: Element | null): string | undefined {
  const t = el?.textContent?.trim();
  return t ? t : undefined;
}

function floatText(el: Element | null): number | undefined {
  const t = textOf(el);
  if (t === undefined) return undefined;
  const v = parseFloat(t);
  return Number.isNaN(v) ? undefined : v;
}

function intAttr(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name);
  if (v === null) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

function floatAttr(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name);
  if (v === null) return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}
