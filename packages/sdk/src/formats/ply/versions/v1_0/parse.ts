import type {ModelParser} from "../../../ModelParser";
import {PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {createUUID, yieldToHost} from "../../../../base/utils";
import type {SceneGeometryParams} from "../../../../model/scene";
import type {LoaderProgress} from "../../../LoaderProgress";

type ScalarType = "char" | "uchar" | "short" | "ushort" | "int" | "uint" | "float" | "double";

interface ScalarProperty {
  kind: "scalar";
  name: string;
  type: ScalarType;
}

interface ListProperty {
  kind: "list";
  name: string;
  countType: ScalarType;
  itemType: ScalarType;
}

type PLYProperty = ScalarProperty | ListProperty;

interface ElementDef {
  name: string;
  count: number;
  properties: PLYProperty[];
  lineStart: number;
}

interface Header {
  format: string;
  elements: ElementDef[];
  dataStartLine: number;
}

export const parse: ModelParser = async (params, options = {}) => {
  const {fileData, sceneModel} = params;
  if (!sceneModel) {
    throw new Error("[PLYLoader] params.sceneModel is required");
  }
  if (typeof fileData !== "string") {
    throw new Error("[PLYLoader] params.fileData must be a string");
  }

  const onProgress: ((p: LoaderProgress) => void) | undefined = options.onProgress;
  const signal: AbortSignal | undefined = options.signal;
  const ignoreNormals = options.ignoreNormals === true;
  const ignoreUVs = options.ignoreUVs === true;
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

  const lines = normalizeNewlines(fileData).split("\n");
  const header = readHeader(lines);
  if (header.format !== "ascii") {
    throw new Error(`[PLYLoader] Unsupported PLY format '${header.format}'. Only ascii 1.0 is supported.`);
  }

  const vertexElement = header.elements.find((e) => e.name === "vertex");
  if (!vertexElement) {
    throw new Error("[PLYLoader] Missing vertex element");
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let cursor = header.dataStartLine;
  for (const element of header.elements) {
    if ((cursor + element.count) > lines.length + 1) {
      throw new Error(`[PLYLoader] Element '${element.name}' is truncated`);
    }
    if (element.name === "vertex") {
      parseVertices(lines, cursor, element, positions, normals, uvs, colors);
    } else if (element.name === "face") {
      parseFaces(lines, cursor, element, indices);
    }
    cursor += element.count;
    await step(`Parsing PLY ${element.name}`, element.count, element.count);
  }

  if (positions.length === 0) {
    throw new Error("[PLYLoader] No vertices found");
  }

  const vertexCount = positions.length / 3;
  const hasFaces = indices.length > 0;
  const geometryCfg: SceneGeometryParams = {
    id: createUUID(),
    primitive: hasFaces ? TrianglesPrimitive : PointsPrimitive,
    positions,
  };

  if (hasFaces) {
    geometryCfg.indices = indices;
  }
  if (!ignoreNormals && normals.length === vertexCount * 3) {
    geometryCfg.normals = normals;
  }
  if (!ignoreUVs && uvs.length === vertexCount * 2) {
    geometryCfg.uvs = uvs;
  }
  if (colors.length === vertexCount * 4) {
    geometryCfg.colors = colors;
  }

  const geom = sceneModel.createGeometry(geometryCfg);
  if (geom.ok === false) {
    throw new Error(`[PLYLoader] ${geom.error}`);
  }

  const meshId = createUUID();
  const mesh = sceneModel.createMesh({
    id: meshId,
    geometryId: geometryCfg.id,
  });
  if (mesh.ok === false) {
    throw new Error(`[PLYLoader] ${mesh.error}`);
  }

  const object = sceneModel.createObject({
    id: createUUID(),
    meshIds: [meshId],
    layerId: options.layerId,
  });
  if (object.ok === false) {
    throw new Error(`[PLYLoader] ${object.error}`);
  }
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readHeader(lines: string[]): Header {
  if ((lines[0] || "").trim() !== "ply") {
    throw new Error("[PLYLoader] Missing PLY magic header");
  }

  let format = "";
  const elements: ElementDef[] = [];
  let currentElement: ElementDef | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("comment ")) {
      continue;
    }
    if (line === "end_header") {
      return {format, elements, dataStartLine: i + 1};
    }

    const parts = line.split(/\s+/);
    if (parts[0] === "format") {
      if (parts[2] !== "1.0") {
        throw new Error(`[PLYLoader] Unsupported PLY version '${parts[2] || ""}'`);
      }
      format = parts[1];
      continue;
    }

    if (parts[0] === "element") {
      currentElement = {
        name: parts[1],
        count: parseInt(parts[2], 10),
        properties: [],
        lineStart: i,
      };
      if (!Number.isFinite(currentElement.count) || currentElement.count < 0) {
        throw new Error(`[PLYLoader] Invalid element count at header line ${i + 1}`);
      }
      elements.push(currentElement);
      continue;
    }

    if (parts[0] === "property") {
      if (!currentElement) {
        throw new Error(`[PLYLoader] Property without element at header line ${i + 1}`);
      }
      if (parts[1] === "list") {
        currentElement.properties.push({
          kind: "list",
          countType: parts[2] as ScalarType,
          itemType: parts[3] as ScalarType,
          name: parts[4],
        });
      } else {
        currentElement.properties.push({
          kind: "scalar",
          type: parts[1] as ScalarType,
          name: parts[2],
        });
      }
      continue;
    }
  }

  throw new Error("[PLYLoader] Missing end_header");
}

function parseVertices(
  lines: string[],
  start: number,
  element: ElementDef,
  positions: number[],
  normals: number[],
  uvs: number[],
  colors: number[],
): void {
  const xIndex = findScalar(element, "x");
  const yIndex = findScalar(element, "y");
  const zIndex = findScalar(element, "z");
  if (xIndex < 0 || yIndex < 0 || zIndex < 0) {
    throw new Error("[PLYLoader] Vertex element must contain x, y and z properties");
  }

  const nxIndex = findScalar(element, "nx");
  const nyIndex = findScalar(element, "ny");
  const nzIndex = findScalar(element, "nz");
  const uIndex = findFirstScalar(element, ["s", "u", "texture_u", "texture_s"]);
  const vIndex = findFirstScalar(element, ["t", "v", "texture_v", "texture_t"]);
  const rIndex = findScalar(element, "red");
  const gIndex = findScalar(element, "green");
  const bIndex = findScalar(element, "blue");
  const aIndex = findScalar(element, "alpha");

  for (let i = 0; i < element.count; i++) {
    const values = splitValues(lines[start + i], element, start + i);
    positions.push(readNumber(values, xIndex), readNumber(values, yIndex), readNumber(values, zIndex));

    if (nxIndex >= 0 && nyIndex >= 0 && nzIndex >= 0) {
      normals.push(readNumber(values, nxIndex), readNumber(values, nyIndex), readNumber(values, nzIndex));
    }
    if (uIndex >= 0 && vIndex >= 0) {
      uvs.push(readNumber(values, uIndex), readNumber(values, vIndex));
    }
    if (rIndex >= 0 && gIndex >= 0 && bIndex >= 0) {
      colors.push(
        colorToFloat(readNumber(values, rIndex)),
        colorToFloat(readNumber(values, gIndex)),
        colorToFloat(readNumber(values, bIndex)),
        aIndex >= 0 ? colorToFloat(readNumber(values, aIndex)) : 1,
      );
    }
  }
}

function parseFaces(lines: string[], start: number, element: ElementDef, indices: number[]): void {
  const faceProperty = element.properties.find((p) => p.kind === "list" && (p.name === "vertex_indices" || p.name === "vertex_index")) as ListProperty | undefined;
  if (!faceProperty) {
    return;
  }

  const propIndex = element.properties.indexOf(faceProperty);
  for (let i = 0; i < element.count; i++) {
    const tokens = splitValues(lines[start + i], element, start + i);
    let cursor = 0;
    for (let j = 0; j < propIndex; j++) {
      const prop = element.properties[j];
      cursor += prop.kind === "list" ? 1 + parseInt(tokens[cursor], 10) : 1;
    }
    const count = parseInt(tokens[cursor], 10);
    if (!Number.isFinite(count) || count < 0 || cursor + count >= tokens.length + 1) {
      throw new Error(`[PLYLoader] Invalid face list at line ${start + i + 1}`);
    }
    const verts: number[] = [];
    for (let j = 0; j < count; j++) {
      verts.push(parseInt(tokens[cursor + 1 + j], 10));
    }
    for (let j = 1; j < verts.length - 1; j++) {
      indices.push(verts[0], verts[j], verts[j + 1]);
    }
  }
}

function findScalar(element: ElementDef, name: string): number {
  return element.properties.findIndex((p) => p.kind === "scalar" && p.name === name);
}

function findFirstScalar(element: ElementDef, names: string[]): number {
  for (const name of names) {
    const index = findScalar(element, name);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

function splitValues(line: string | undefined, element: ElementDef, lineIndex: number): string[] {
  const values = (line || "").trim().split(/\s+/);
  if (values.length < element.properties.length) {
    throw new Error(`[PLYLoader] Not enough values at line ${lineIndex + 1}`);
  }
  return values;
}

function readNumber(values: string[], index: number): number {
  const value = Number(values[index]);
  return Number.isFinite(value) ? value : 0;
}

function colorToFloat(value: number): number {
  return value > 1 ? Math.max(0, Math.min(255, value)) / 255 : Math.max(0, Math.min(1, value));
}
