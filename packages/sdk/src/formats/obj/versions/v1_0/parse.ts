
// @ts-ignore
import type { ModelParser } from "../../../ModelParser";
import { TrianglesPrimitive } from "../../../../constants";

import { createUUID } from "../../../../utils";
import { type SceneGeometryParams } from "../../../../scene";

/**
 * @private
 */
export const parse: ModelParser = async (
  params,
  options
) => {
  return new Promise<void>((resolve, reject) => {
    const { fileData, sceneModel, dataModel } = params;

    if (sceneModel || dataModel) {
      const ctx: ParseContext = {
        fileData,
        errors: [],
        warnings: [],
        sceneModel,
        dataModel,
        nextId: 0,
        options: options || {},

        srcPositions: [],
        srcNormals: [],
        srcUVs: [],

        materials: {},

        currentObject: null
      };

      parseOBJDirect(ctx);

      if (ctx.currentObject) {
        flushCurrentObject(ctx);
      }

      if (ctx.errors.length > 0) {
        return reject(`[OBJLoader] Failed to parse OBJ file: ${ctx.errors[0]}`);
      }

      if (ctx.warnings.length > 0) {
        console.warn(`[OBJLoader] Warning while parsing OBJ file: ${ctx.warnings[0]}`);
      }
    }

    resolve();
  });
};

interface ParsedMaterial {
  color: [number, number, number];
  opacity: number;
}

interface ParseContext {
  fileData: string;
  errors: string[];
  warnings: string[];
  sceneModel: any;
  dataModel: any;
  nextId: number;
  options: any;
  srcPositions: number[];
  srcNormals: number[];
  srcUVs: number[];
  materials:  Record<string, ParsedMaterial>
  currentObject: WorkingObject | null;
}

interface WorkingGeometry {
  positions: number[];
  normals: number[];
  uv: number[];
  indices: number[];
  type?: "Line";
}

interface WorkingMaterial {
  id: string;
  smooth: boolean;
}

interface WorkingObject {
  id: string;
  geometry: WorkingGeometry;
  material: WorkingMaterial;
  fromDeclaration: boolean;
  vertexMap: Map<string, number>;
}

const regexp = {
  vertex_pattern: /^v\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)/,
  normal_pattern: /^vn\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)/,
  uv_pattern: /^vt\s+([\d.+\-eE]+)\s+([\d.+\-eE]+)/,
  object_pattern: /^[og]\s*(.+)?/,
  smoothing_pattern: /^s\s+(\d+|on|off)/,
  material_library_pattern: /^mtllib /,
  material_use_pattern: /^usemtl /
};

function parseOBJDirect(ctx: ParseContext): void {
  let fileData = ctx.fileData;

  startObject(ctx, "", false);

  if (fileData.indexOf("\r\n") !== -1) {
    fileData = fileData.replace(/\r\n/g, "\n");
  }

  const lines = fileData.split("\n");
  let result: RegExpExecArray | null = null;
  const trimLeft = typeof "".trimStart === "function";

  for (let i = 0, l = lines.length; i < l; i++) {
    let line = lines[i];
    line = trimLeft ? line.trimStart() : line.trim();

    if (line.length === 0) {
      continue;
    }

    const lineFirstChar = line.charAt(0);

    if (lineFirstChar === "#") {
      continue;
    }

    if (lineFirstChar === "v") {
      const lineSecondChar = line.charAt(1);

      if (lineSecondChar === " " && (result = regexp.vertex_pattern.exec(line)) !== null) {
        ctx.srcPositions.push(
          parseFloat(result[1]),
          parseFloat(result[2]),
          parseFloat(result[3])
        );
      } else if (lineSecondChar === "n" && (result = regexp.normal_pattern.exec(line)) !== null) {
        ctx.srcNormals.push(
          parseFloat(result[1]),
          parseFloat(result[2]),
          parseFloat(result[3])
        );
      } else if (lineSecondChar === "t" && (result = regexp.uv_pattern.exec(line)) !== null) {
        ctx.srcUVs.push(
          parseFloat(result[1]),
          parseFloat(result[2])
        );
      } else {
        ctx.errors.push(`Unexpected vertex/normal/uv line: '${line}'`);
        return;
      }
      continue;
    }

    if (lineFirstChar === "f") {
      parseFaceLine(ctx, line);
      if (ctx.errors.length > 0) {
        return;
      }
      continue;
    }

    if (lineFirstChar === "l") {
      addLineGeometry(ctx, line);
      continue;
    }

    if ((result = regexp.object_pattern.exec(line)) !== null) {
      const id = result[0].substring(1).trim();

      if (ctx.currentObject && ctx.currentObject.geometry.indices.length > 0) {
        flushCurrentObject(ctx);
      }

      startObject(ctx, id, true);
      continue;
    }

    if (regexp.material_use_pattern.test(line)) {
      if (ctx.currentObject) {
        ctx.currentObject.material.id = line.substring(7).trim();
      }
      continue;
    }

    if (regexp.material_library_pattern.test(line)) {
      continue;
    }

    if ((result = regexp.smoothing_pattern.exec(line)) !== null) {
      if (ctx.currentObject) {
        const value = result[1].trim().toLowerCase();
        ctx.currentObject.material.smooth = value === "1" || value === "on";
      }
      continue;
    }

    if (line === "\0") {
      continue;
    }

    ctx.errors.push(`Unexpected line: '${line}'`);
    return;
  }
}

function startObject(ctx: ParseContext, id: string, fromDeclaration: boolean): void {
  if (ctx.currentObject && ctx.currentObject.fromDeclaration === false) {
    ctx.currentObject.id = id;
    ctx.currentObject.fromDeclaration = fromDeclaration !== false;
    return;
  }

  ctx.currentObject = {
    id: id || "",
    geometry: {
      positions: [],
      normals: [],
      uv: [],
      indices: []
    },
    material: {
      id: "",
      smooth: true
    },
    fromDeclaration: fromDeclaration !== false,
    vertexMap: new Map<string, number>()
  };
}

function flushCurrentObject(ctx: ParseContext): void {
  const object = ctx.currentObject;
  if (!object) {
    return;
  }

  const geometry = object.geometry;
  if (geometry.indices.length === 0 || geometry.positions.length === 0) {
    return;
  }

  if (geometry.type === "Line") {
    ctx.warnings.push(`Skipping line geometry object '${object.id}'`);
    return;
  }

  const geometryId = createUUID();

  const geometryCfg: SceneGeometryParams = {
    id: geometryId,
    primitive: TrianglesPrimitive,
    positions: geometry.positions.slice(),
    indices: geometry.indices.slice()
  };

  if (geometry.uv.length > 0) {
    // geometryCfg.uv = geometry.uv;
  }

  const createGeometryResult = ctx.sceneModel.createGeometry(geometryCfg);
  if (createGeometryResult.ok !== true) {
    ctx.errors.push(`Failed to create geometry for object '${object.id}'`);
    return;
  }

  const meshId = createUUID();

  const materialId = object.material.id;
  const mat = ctx.materials[materialId];

  const color = mat?.color ?? [0.8, 0.8, 0.8];
  const opacity = mat?.opacity ?? 1;

  const createMeshResult = ctx.sceneModel.createMesh({
    id: meshId,
    geometryId,
    materialId,
    color,
    opacity
  });

  if (createMeshResult.ok !== true) {
    ctx.errors.push(`Failed to create mesh for object '${object.id}'`);
    return;
  }

  const objectId = createUUID();

  const createObjectResult = ctx.sceneModel.createObject({
    id: objectId,
    meshIds: [meshId]
  });

  if (createObjectResult.ok !== true) {
    ctx.errors.push(`Failed to create object for object '${object.id}'`);
    return;
  }

  geometry.positions.length = 0;
  geometry.normals.length = 0;
  geometry.uv.length = 0;
  geometry.indices.length = 0;
  object.vertexMap.clear();
}

function parseVertexIndex(value: string, len: number): number {
  const index = parseInt(value, 10);
  return (index >= 0 ? index - 1 : index + len / 3) * 3;
}

function parseNormalIndex(value: string, len: number): number {
  const index = parseInt(value, 10);
  return (index >= 0 ? index - 1 : index + len / 3) * 3;
}

function parseUVIndex(value: string, len: number): number {
  const index = parseInt(value, 10);
  return (index >= 0 ? index - 1 : index + len / 2) * 2;
}

function getOrCreateVertex(
  ctx: ParseContext,
  v: string,
  uv?: string,
  n?: string
): number {
  const object = ctx.currentObject!;
  const geometry = object.geometry;

  const vIndex = parseVertexIndex(v, ctx.srcPositions.length);
  const uvIndex = uv !== undefined ? parseUVIndex(uv, ctx.srcUVs.length) : -1;
  const nIndex = n !== undefined ? parseNormalIndex(n, ctx.srcNormals.length) : -1;

  const key = `${vIndex}/${uvIndex}/${nIndex}`;

  const existing = object.vertexMap.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const dstIndex = geometry.positions.length / 3;
  object.vertexMap.set(key, dstIndex);

  geometry.positions.push(
    ctx.srcPositions[vIndex],
    ctx.srcPositions[vIndex + 1],
    ctx.srcPositions[vIndex + 2]
  );

  if (uvIndex !== -1) {
    geometry.uv.push(
      ctx.srcUVs[uvIndex],
      ctx.srcUVs[uvIndex + 1]
    );
  }

  if (nIndex !== -1) {
    geometry.normals.push(
      ctx.srcNormals[nIndex],
      ctx.srcNormals[nIndex + 1],
      ctx.srcNormals[nIndex + 2]
    );
  }

  return dstIndex;
}

function addFace(
  ctx: ParseContext,
  a: string,
  b: string,
  c: string,
  d?: string,
  ua?: string,
  ub?: string,
  uc?: string,
  ud?: string,
  na?: string,
  nb?: string,
  nc?: string,
  nd?: string
): void {
  const geometry = ctx.currentObject!.geometry;

  const ia = getOrCreateVertex(ctx, a, ua, na);
  const ib = getOrCreateVertex(ctx, b, ub, nb);
  const ic = getOrCreateVertex(ctx, c, uc, nc);

  if (d === undefined) {
    geometry.indices.push(ia, ib, ic);
    return;
  }

  const id = getOrCreateVertex(ctx, d, ud, nd);

  geometry.indices.push(ia, ib, id);
  geometry.indices.push(ib, ic, id);
}

function parseFaceLine(ctx: ParseContext, line: string): void {
  // Supports:
  // f v v v [v]
  // f v/vt v/vt v/vt [v/vt]
  // f v//vn v//vn v//vn [v//vn]
  // f v/vt/vn v/vt/vn v/vt/vn [v/vt/vn]
  // Also works for n-gons via fan triangulation preserving prior quad behavior.

  const refs: FaceRef[] = [];
  const body = line.substring(1).trim();
  let tokenStart = 0;

  for (let i = 0, len = body.length; i <= len; i++) {
    const isEnd = i === len || body.charCodeAt(i) === 32;
    if (!isEnd) {
      continue;
    }

    if (i === tokenStart) {
      tokenStart = i + 1;
      continue;
    }

    const token = body.substring(tokenStart, i);
    const ref = parseFaceToken(token);

    if (!ref || ref.v === "") {
      ctx.errors.push(`Unexpected face line: '${line}'`);
      return;
    }

    refs.push(ref);
    tokenStart = i + 1;
  }

  if (refs.length < 3) {
    ctx.errors.push(`Unexpected face line: '${line}'`);
    return;
  }

  if (refs.length === 3) {
    const a = refs[0];
    const b = refs[1];
    const c = refs[2];
    addFace(ctx, a.v, b.v, c.v, undefined, a.vt, b.vt, c.vt, undefined, a.vn, b.vn, c.vn, undefined);
    return;
  }

  if (refs.length === 4) {
    const a = refs[0];
    const b = refs[1];
    const c = refs[2];
    const d = refs[3];
    addFace(ctx, a.v, b.v, c.v, d.v, a.vt, b.vt, c.vt, d.vt, a.vn, b.vn, c.vn, d.vn);
    return;
  }

  // Fan triangulation for n-gons (n > 4).
  // Preserves 3/4 behavior above and extends reasonably for larger faces.
  const a = refs[0];
  for (let i = 1; i < refs.length - 1; i++) {
    const b = refs[i];
    const c = refs[i + 1];
    addFace(ctx, a.v, b.v, c.v, undefined, a.vt, b.vt, c.vt, undefined, a.vn, b.vn, c.vn, undefined);
  }
}

interface FaceRef {
  v: string;
  vt?: string;
  vn?: string;
}

function parseFaceToken(token: string): FaceRef | null {
  const slash0 = token.indexOf("/");
  if (slash0 === -1) {
    return { v: token };
  }

  const v = token.substring(0, slash0);
  const after0 = token.substring(slash0 + 1);
  const slash1 = after0.indexOf("/");

  if (slash1 === -1) {
    const vt = after0;
    return {
      v,
      vt: vt !== "" ? vt : undefined
    };
  }

  const vt = after0.substring(0, slash1);
  const vn = after0.substring(slash1 + 1);

  return {
    v,
    vt: vt !== "" ? vt : undefined,
    vn: vn !== "" ? vn : undefined
  };
}

function addVertexLine(ctx: ParseContext, a: number): void {
  const dst = ctx.currentObject!.geometry.positions;
  const src = ctx.srcPositions;

  dst.push(src[a], src[a + 1], src[a + 2]);
}

function addUVLine(ctx: ParseContext, a: number): void {
  const dst = ctx.currentObject!.geometry.uv;
  const src = ctx.srcUVs;

  dst.push(src[a], src[a + 1]);
}

function addLineGeometry(ctx: ParseContext, line: string): void {
  const object = ctx.currentObject!;
  object.geometry.type = "Line";

  const vLen = ctx.srcPositions.length;
  const uvLen = ctx.srcUVs.length;

  const body = line.substring(1).trim();
  let tokenStart = 0;

  for (let i = 0, len = body.length; i <= len; i++) {
    const isEnd = i === len || body.charCodeAt(i) === 32;
    if (!isEnd) {
      continue;
    }

    if (i === tokenStart) {
      tokenStart = i + 1;
      continue;
    }

    const token = body.substring(tokenStart, i);
    const slash0 = token.indexOf("/");

    if (slash0 === -1) {
      addVertexLine(ctx, parseVertexIndex(token, vLen));
    } else {
      const v = token.substring(0, slash0);
      const rest = token.substring(slash0 + 1);
      const slash1 = rest.indexOf("/");

      const uv = slash1 === -1 ? rest : rest.substring(0, slash1);

      if (v) {
        addVertexLine(ctx, parseVertexIndex(v, vLen));
      }
      if (uv) {
        addUVLine(ctx, parseUVIndex(uv, uvLen));
      }
    }

    tokenStart = i + 1;
  }
}
