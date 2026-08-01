// @ts-ignore
import {earcut} from "../../../cityjson/versions/v1_0/earcut";
import {TrianglesPrimitive} from "../../../../base/constants";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";
import type {ModelParser} from "../../../ModelParser";
import type {CityGMLLoadOptions} from "../../CityGMLLoadOptions";

const GML_NS = "http://www.opengis.net/gml";
const SCHEMA = "citygml_2_0";
const DEFAULT_COLOR: [number, number, number] = [0.75, 0.75, 0.72];

const NON_FEATURE_LOCAL_NAMES = new Set([
  "CityModel",
  "cityObjectMember",
  "featureMember",
  "boundedBy",
  "Polygon",
  "Triangle",
  "Rectangle",
  "LinearRing",
  "MultiSurface",
  "CompositeSurface",
  "Surface",
  "Solid",
  "CompositeSolid",
  "MultiSolid",
  "Shell",
  "surfaceMember",
  "surfaceMembers",
  "solidMember",
  "solidMembers",
  "exterior",
  "interior",
  "posList",
  "pos",
  "Point",
  "LineString",
  "MultiCurve",
  "Curve",
  "segments",
  "LineStringSegment"
]);

type Vec3 = [number, number, number];

interface CityGMLFeature {
  element: Element;
  originalId: string;
  id: string;
  type: string;
  name?: string;
  parent?: CityGMLFeature;
}

interface ParseContext {
  sceneModel: any;
  dataModel: any;
  options: CityGMLLoadOptions;
  errors: string[];
  warnings: string[];
  nextId: number;
  featureElements: Set<Element>;
  elementsById: Map<string, Element>;
}

/**
 * @private
 */
export const parse: ModelParser = async (
  params,
  options
) => {
  const {fileData, sceneModel, dataModel} = params;
  const opts: CityGMLLoadOptions = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      onProgress(progress);
    }
    await yieldToHost(signal);
  };

  if (!sceneModel && !dataModel) {
    return;
  }

  const root = await getRootElement(fileData);
  if (!root) {
    throw new Error("[CityGMLLoader] Failed to parse CityGML file: XML Document or Element expected");
  }

  const usedIds = new Set<string>();
  const features = collectFeatures(root, usedIds);
  const ctx: ParseContext = {
    sceneModel,
    dataModel,
    options: opts,
    errors: [],
    warnings: [],
    nextId: 0,
    featureElements: new Set(features.map(feature => feature.element)),
    elementsById: buildElementById(root)
  };

  const total = features.length;
  for (let i = 0; i < total; i++) {
    if ((i & 0x1F) === 0) {
      await step("Parsing CityGML features", i, total);
    }
    if (!parseFeature(ctx, features[i])) {
      throw new Error(`[CityGMLLoader] Failed to parse CityGML file: ${ctx.errors[0]}`);
    }
  }

  if (dataModel) {
    for (let i = 0; i < total; i++) {
      if ((i & 0x3F) === 0) {
        await step("Building CityGML relationships", i, total);
      }
      if (!parseRelationship(ctx, features[i])) {
        throw new Error(`[CityGMLLoader] Failed to parse CityGML file: ${ctx.errors[0]}`);
      }
    }
  }

  await step("Parsing CityGML features", total, total);

  if (ctx.warnings.length > 0) {
    console.warn(`[CityGMLLoader] Warning while parsing CityGML file: ${ctx.warnings[0]}`);
  }
};

async function getRootElement(fileData: any): Promise<Element | null> {
  if (!fileData) {
    return null;
  }
  if (fileData.nodeType === 9) {
    return fileData.documentElement || null;
  }
  if (fileData.nodeType === 1) {
    return fileData;
  }
  const text = await fileDataToText(fileData);
  if (typeof DOMParser === "undefined") {
    throw new Error("[CityGMLLoader] DOMParser is required to parse CityGML text input");
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = localName(doc.documentElement) === "parsererror"
    ? doc.documentElement
    : firstDescendantByLocalName(doc.documentElement, "parsererror");
  if (parserError) {
    throw new Error(`[CityGMLLoader] Failed to parse CityGML XML: ${textContent(parserError) || "invalid XML"}`);
  }
  return doc.documentElement;
}

async function fileDataToText(fileData: any): Promise<string> {
  if (typeof fileData === "string") {
    return fileData;
  }
  if (fileData instanceof ArrayBuffer) {
    return new TextDecoder().decode(fileData);
  }
  if (ArrayBuffer.isView(fileData)) {
    return new TextDecoder().decode(fileData);
  }
  if (typeof fileData.text === "function") {
    return fileData.text();
  }
  return String(fileData);
}

function collectFeatures(root: Element, usedIds: Set<string>): CityGMLFeature[] {
  const features: CityGMLFeature[] = [];

  const visit = (element: Element, parent?: CityGMLFeature) => {
    const feature = isFeatureElement(element)
      ? {
        element,
        originalId: getGmlId(element)!,
        id: uniqueId(getGmlId(element)!, usedIds),
        type: localName(element),
        name: firstChildText(element, "name"),
        parent
      }
      : undefined;

    if (feature) {
      features.push(feature);
    }

    const nextParent = feature || parent;
    forEachElementChild(element, child => visit(child, nextParent));
  };

  visit(root);
  return features;
}

function isFeatureElement(element: Element): boolean {
  const id = getGmlId(element);
  if (!id) {
    return false;
  }
  const name = localName(element);
  if (NON_FEATURE_LOCAL_NAMES.has(name)) {
    return false;
  }
  return hasDescendantSurfaceGeometry(element);
}

function hasDescendantSurfaceGeometry(element: Element): boolean {
  let found = false;
  walkDescendants(element, child => {
    if (isSurfaceGeometryElement(child) || getHref(child)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function parseFeature(ctx: ParseContext, feature: CityGMLFeature): boolean {
  if (ctx.dataModel) {
    const result = ctx.dataModel.createObject({
      id: feature.id,
      originalSystemId: feature.originalId,
      name: feature.name || `${feature.type} : ${feature.originalId}`,
      type: feature.type,
      schema: SCHEMA
    });
    if (!result.ok) {
      ctx.errors.push(`Failed to create DataObject for CityGML feature ${feature.originalId} -> ${result.error}`);
      return false;
    }
  }

  if (!ctx.sceneModel) {
    return true;
  }

  const geometry = buildFeatureGeometry(ctx, feature);
  if (geometry.positions.length === 0 || geometry.indices.length === 0) {
    return true;
  }

  const geometryId = uniqueGeneratedId(ctx, `${feature.id}-geometry`);
  const geometryResult = ctx.sceneModel.createGeometry({
    id: geometryId,
    primitive: TrianglesPrimitive,
    positions: geometry.positions,
    indices: geometry.indices
  });
  if (!geometryResult.ok) {
    ctx.errors.push(`Failed to create SceneGeometry for CityGML feature ${feature.originalId} -> ${geometryResult.error}`);
    return false;
  }

  const meshId = uniqueGeneratedId(ctx, `${feature.id}-mesh`);
  const meshResult = ctx.sceneModel.createMesh({
    id: meshId,
    geometryId,
    color: colorForFeatureType(feature.type),
    opacity: 1.0
  });
  if (!meshResult.ok) {
    ctx.errors.push(`Failed to create SceneMesh for CityGML feature ${feature.originalId} -> ${meshResult.error}`);
    return false;
  }

  const objectResult = ctx.sceneModel.createObject({
    id: feature.id,
    originalSystemId: feature.originalId,
    meshIds: [meshId],
    layerId: ctx.options.layerId
  });
  if (!objectResult.ok) {
    ctx.errors.push(`Failed to create SceneObject for CityGML feature ${feature.originalId} -> ${objectResult.error}`);
    return false;
  }
  return true;
}

function parseRelationship(ctx: ParseContext, feature: CityGMLFeature): boolean {
  if (!feature.parent || !ctx.dataModel) {
    return true;
  }
  const result = ctx.dataModel.createRelationship({
    relatingObjectId: feature.parent.id,
    relatedObjectId: feature.id,
    type: "BasicAggregation",
    schema: SCHEMA
  });
  if (!result.ok) {
    ctx.errors.push(`Failed to create DataRelationship for CityGML feature ${feature.originalId} -> ${result.error}`);
    return false;
  }
  return true;
}

function buildFeatureGeometry(ctx: ParseContext, feature: CityGMLFeature): {positions: number[]; indices: number[]} {
  const geometry = {
    positions: [] as number[],
    indices: [] as number[]
  };

  const visit = (element: Element) => {
    if (element !== feature.element && ctx.featureElements.has(element)) {
      return;
    }
    const href = getHref(element);
    if (href) {
      const referencedElement = ctx.elementsById.get(href);
      if (referencedElement) {
        parseGeometryElement(ctx, referencedElement, geometry);
      }
    }
    if (isSurfaceGeometryElement(element)) {
      parseGeometryElement(ctx, element, geometry);
      return;
    }
    forEachElementChild(element, visit);
  };

  visit(feature.element);
  return geometry;
}

function parseGeometryElement(ctx: ParseContext, element: Element, geometry: {positions: number[]; indices: number[]}): void {
  if (localName(element) === "Polygon" || localName(element) === "Triangle" || localName(element) === "Rectangle") {
    parsePolygon(ctx, element, geometry);
    return;
  }
  forEachElementChild(element, child => {
    if (isSurfaceGeometryElement(child)) {
      parseGeometryElement(ctx, child, geometry);
    }
  });
}

function parsePolygon(ctx: ParseContext, polygon: Element, geometry: {positions: number[]; indices: number[]}): void {
  const rings = readPolygonRings(ctx, polygon);
  if (rings.length === 0 || rings[0].length < 9) {
    return;
  }

  const normal = normalOfRing(rings[0]);
  const dropAxis = dominantAxis(normal);
  const flat: number[] = [];
  const holes: number[] = [];
  let vertexCount = 0;

  const startIndex = geometry.positions.length / 3;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.length < 9) {
      continue;
    }
    if (i > 0) {
      holes.push(vertexCount);
    }
    for (let j = 0; j < ring.length; j += 3) {
      const x = ring[j];
      const y = ring[j + 1];
      const z = ring[j + 2];
      geometry.positions.push(x, y, z);
      pushProjected(flat, dropAxis, x, y, z);
      vertexCount++;
    }
  }

  if (vertexCount < 3) {
    return;
  }

  const triangles = earcut(flat, holes, 2);
  for (let i = 0; i < triangles.length; i += 3) {
    geometry.indices.push(
      startIndex + triangles[i],
      startIndex + triangles[i + 1],
      startIndex + triangles[i + 2]
    );
  }
}

function readPolygonRings(ctx: ParseContext, polygon: Element): number[][] {
  const rings: number[][] = [];
  const exterior = firstDescendantByLocalName(polygon, "exterior");
  const exteriorRing = exterior
    ? firstDescendantByLocalName(exterior, "LinearRing")
    : firstDescendantByLocalName(polygon, "LinearRing");

  if (exteriorRing) {
    const ring = readLinearRing(ctx, exteriorRing);
    if (ring.length >= 9) {
      rings.push(ring);
    }
  }

  const interiors = descendantsByLocalName(polygon, "interior");
  for (let i = 0; i < interiors.length; i++) {
    const ringElement = firstDescendantByLocalName(interiors[i], "LinearRing");
    if (ringElement) {
      const ring = readLinearRing(ctx, ringElement);
      if (ring.length >= 9) {
        rings.push(ring);
      }
    }
  }

  if (rings.length === 0) {
    const linearRings = descendantsByLocalName(polygon, "LinearRing");
    for (let i = 0; i < linearRings.length; i++) {
      const ring = readLinearRing(ctx, linearRings[i]);
      if (ring.length >= 9) {
        rings.push(ring);
      }
    }
  }

  return rings;
}

function readLinearRing(ctx: ParseContext, ring: Element): number[] {
  const posList = firstDescendantByLocalName(ring, "posList");
  const points: number[] = [];
  const localOrigin = ctx.options.localOrigin;

  if (posList) {
    const values = numbersFromText(textContent(posList));
    const dimension = coordinateDimension(posList, values.length);
    for (let i = 0; i + 1 < values.length; i += dimension) {
      points.push(
        values[i] - (localOrigin?.[0] ?? 0),
        values[i + 1] - (localOrigin?.[1] ?? 0),
        (values[i + 2] ?? 0) - (localOrigin?.[2] ?? 0)
      );
    }
  } else {
    const poses = descendantsByLocalName(ring, "pos");
    for (let i = 0; i < poses.length; i++) {
      const values = numbersFromText(textContent(poses[i]));
      if (values.length >= 2) {
        points.push(
          values[0] - (localOrigin?.[0] ?? 0),
          values[1] - (localOrigin?.[1] ?? 0),
          (values[2] ?? 0) - (localOrigin?.[2] ?? 0)
        );
      }
    }
  }

  if (points.length >= 6 && samePoint(points, 0, points.length - 3)) {
    points.length -= 3;
  }
  return points;
}

function coordinateDimension(element: Element, valueCount: number): number {
  let cursor: Element | null = element;
  while (cursor) {
    const srsDimension = cursor.getAttribute("srsDimension") || cursor.getAttribute("dimension");
    if (srsDimension) {
      const parsed = Number.parseInt(srsDimension, 10);
      if (Number.isFinite(parsed) && parsed >= 2) {
        return parsed;
      }
    }
    cursor = cursor.parentElement;
  }
  return valueCount % 3 === 0 ? 3 : 2;
}

function normalOfRing(ring: number[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const len = ring.length;
  for (let i = 0; i < len; i += 3) {
    const next = (i + 3) % len;
    const x = ring[i], y = ring[i + 1], z = ring[i + 2];
    const nx2 = ring[next], ny2 = ring[next + 1], nz2 = ring[next + 2];
    nx += (y - ny2) * (z + nz2);
    ny += (z - nz2) * (x + nx2);
    nz += (x - nx2) * (y + ny2);
  }
  return [nx, ny, nz];
}

function dominantAxis(normal: Vec3): 0 | 1 | 2 {
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  if (ax >= ay && ax >= az) {
    return 0;
  }
  if (ay >= ax && ay >= az) {
    return 1;
  }
  return 2;
}

function pushProjected(flat: number[], dropAxis: 0 | 1 | 2, x: number, y: number, z: number): void {
  switch (dropAxis) {
    case 0:
      flat.push(y, z);
      break;
    case 1:
      flat.push(x, z);
      break;
    default:
      flat.push(x, y);
      break;
  }
}

function numbersFromText(text: string): number[] {
  const tokens = text.trim().split(/\s+/);
  const values: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const value = Number(tokens[i]);
    if (Number.isFinite(value)) {
      values.push(value);
    }
  }
  return values;
}

function samePoint(points: number[], a: number, b: number): boolean {
  return Math.abs(points[a] - points[b]) < 1e-9
    && Math.abs(points[a + 1] - points[b + 1]) < 1e-9
    && Math.abs(points[a + 2] - points[b + 2]) < 1e-9;
}

function buildElementById(root: Element): Map<string, Element> {
  const elementsById = new Map<string, Element>();
  const visit = (element: Element) => {
    const id = getGmlId(element);
    if (id) {
      elementsById.set(id, element);
    }
    forEachElementChild(element, visit);
  };
  visit(root);
  return elementsById;
}

function isSurfaceGeometryElement(element: Element): boolean {
  const name = localName(element);
  return name === "Polygon" || name === "Triangle" || name === "Rectangle";
}

function firstDescendantByLocalName(element: Element, name: string): Element | undefined {
  let found: Element | undefined;
  walkDescendants(element, child => {
    if (localName(child) === name) {
      found = child;
      return false;
    }
    return true;
  });
  return found;
}

function descendantsByLocalName(element: Element, name: string): Element[] {
  const result: Element[] = [];
  walkDescendants(element, child => {
    if (localName(child) === name) {
      result.push(child);
    }
    return true;
  });
  return result;
}

function walkDescendants(element: Element, visitor: (element: Element) => boolean): boolean {
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children.item(i)!;
    if (visitor(child) === false) {
      return false;
    }
    if (walkDescendants(child, visitor) === false) {
      return false;
    }
  }
  return true;
}

function forEachElementChild(element: Element, callback: (child: Element) => void): void {
  for (let i = 0; i < element.children.length; i++) {
    callback(element.children.item(i)!);
  }
}

function localName(element: Element): string {
  const name = element.localName || element.nodeName;
  const colon = name.indexOf(":");
  return colon >= 0 ? name.slice(colon + 1) : name;
}

function getGmlId(element: Element): string | undefined {
  return element.getAttribute("gml:id")
    || element.getAttributeNS(GML_NS, "id")
    || element.getAttribute("id")
    || undefined;
}

function getHref(element: Element): string | undefined {
  const href = element.getAttribute("xlink:href")
    || element.getAttributeNS("http://www.w3.org/1999/xlink", "href")
    || element.getAttribute("href")
    || undefined;
  return href && href.charAt(0) === "#" ? href.slice(1) : undefined;
}

function textContent(element: Element): string {
  return element.textContent || "";
}

function firstChildText(element: Element, name: string): string | undefined {
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children.item(i)!;
    if (localName(child) === name) {
      const text = textContent(child).trim();
      return text || undefined;
    }
  }
  return undefined;
}

function uniqueId(id: string, usedIds: Set<string>): string {
  let candidate = id;
  let suffix = 1;
  while (usedIds.has(candidate)) {
    candidate = `${id}_${suffix++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function uniqueGeneratedId(ctx: ParseContext, prefix: string): string {
  return `${prefix}_${ctx.nextId++}`;
}

function colorForFeatureType(type: string): [number, number, number] {
  const normalized = type.toLowerCase();
  if (normalized.includes("roof")) {
    return [0.58, 0.22, 0.18];
  }
  if (normalized.includes("wall") || normalized.includes("building")) {
    return [0.72, 0.68, 0.60];
  }
  if (normalized.includes("ground") || normalized.includes("floor")) {
    return [0.45, 0.48, 0.42];
  }
  if (normalized.includes("water")) {
    return [0.22, 0.42, 0.68];
  }
  if (normalized.includes("vegetation") || normalized.includes("plant")) {
    return [0.24, 0.48, 0.26];
  }
  if (normalized.includes("road") || normalized.includes("transport") || normalized.includes("traffic")) {
    return [0.28, 0.29, 0.30];
  }
  return DEFAULT_COLOR;
}
