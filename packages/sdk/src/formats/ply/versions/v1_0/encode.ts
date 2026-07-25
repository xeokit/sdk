import {PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {decompressPoint3WithAABB3, octDecodeNormalsU16} from "../../../../base/math/compression";
import {createVec3Float64} from "../../../../base/math/vector";
import {transformPoint3} from "../../../../base/math/matrix";
import {getMeshWorldMatrix} from "../../../../model/scene";
import {yieldToHost} from "../../../../base/utils";
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import type {LoaderProgress} from "../../../LoaderProgress";

const tempCompressed = createVec3Float64();
const tempPosition = createVec3Float64();
const tempWorld = createVec3Float64();

interface OutputVertex {
  x: number;
  y: number;
  z: number;
  nx?: number;
  ny?: number;
  nz?: number;
  s?: number;
  t?: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export async function encode(params: ModelEncodeParams, options?: any): Promise<string> {
  const {sceneModel} = params;
  if (!sceneModel) {
    throw new Error("[PLYExporter] params.sceneModel is required");
  }

  const opts = options || {};
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

  const vertices: OutputVertex[] = [];
  const faces: number[][] = [];
  const sceneObjects = Object.values(sceneModel.objects || {});

  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    if ((i & 0x1F) === 0) await step("Encoding PLY", i, len);
    const sceneObject: any = sceneObjects[i];
    const meshes = sceneObject.meshes || [];
    for (const mesh of meshes) {
      appendMesh(mesh, vertices, faces);
    }
  }

  await step("Encoding PLY", sceneObjects.length, sceneObjects.length);
  if (vertices.length === 0) {
    throw new Error("[PLYExporter] no triangle or point geometry found to export");
  }

  const hasFaces = faces.length > 0;
  const hasNormals = vertices.some((v) => v.nx !== undefined && v.ny !== undefined && v.nz !== undefined);
  const hasUVs = vertices.some((v) => v.s !== undefined && v.t !== undefined);

  const lines: string[] = [
    "ply",
    "format ascii 1.0",
    "comment Created by xeokit PLYExporter",
    `element vertex ${vertices.length}`,
    "property float x",
    "property float y",
    "property float z",
  ];

  if (hasNormals) {
    lines.push("property float nx", "property float ny", "property float nz");
  }
  if (hasUVs) {
    lines.push("property float s", "property float t");
  }
  lines.push(
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    "property uchar alpha",
  );

  if (hasFaces) {
    lines.push(`element face ${faces.length}`);
    lines.push("property list uchar int vertex_indices");
  }
  lines.push("end_header");

  for (const vertex of vertices) {
    const values = [
      formatNum(vertex.x),
      formatNum(vertex.y),
      formatNum(vertex.z),
    ];
    if (hasNormals) {
      values.push(formatNum(vertex.nx ?? 0), formatNum(vertex.ny ?? 0), formatNum(vertex.nz ?? 1));
    }
    if (hasUVs) {
      values.push(formatNum(vertex.s ?? 0), formatNum(vertex.t ?? 0));
    }
    values.push(
      String(vertex.red),
      String(vertex.green),
      String(vertex.blue),
      String(vertex.alpha),
    );
    lines.push(values.join(" "));
  }

  for (const face of faces) {
    lines.push(`${face.length} ${face.join(" ")}`);
  }

  return lines.join("\n");
}

function appendMesh(mesh: any, vertices: OutputVertex[], faces: number[][]): void {
  const geometry = mesh.geometry;
  if (!geometry || (geometry.primitive !== TrianglesPrimitive && geometry.primitive !== PointsPrimitive)) {
    return;
  }

  const positionsCompressed = geometry.positionsCompressed;
  if (!positionsCompressed || positionsCompressed.length === 0 || !geometry.aabb) {
    return;
  }

  const vertexOffset = vertices.length;
  const vertexCount = positionsCompressed.length / 3;
  const matrix = getMeshWorldMatrix(mesh);
  const decodedNormals = geometry.normalsCompressed
    ? octDecodeNormalsU16(geometry.normalsCompressed, new Float32Array((geometry.normalsCompressed.length / 2) * 3))
    : null;
  const uvs = geometry.uvsCompressed;
  const colors = geometry.colorsCompressed;
  const meshColor = mesh.color || [1, 1, 1];
  const meshOpacity = mesh.opacity !== undefined ? mesh.opacity : 1;

  for (let i = 0; i < vertexCount; i++) {
    const src = i * 3;
    tempCompressed[0] = positionsCompressed[src];
    tempCompressed[1] = positionsCompressed[src + 1];
    tempCompressed[2] = positionsCompressed[src + 2];
    decompressPoint3WithAABB3(tempCompressed, geometry.aabb, tempPosition);
    transformPoint3(matrix, tempPosition, tempWorld);

    const vertex: OutputVertex = {
      x: tempWorld[0],
      y: tempWorld[1],
      z: tempWorld[2],
      red: colors ? colors[i * 4] : toByte(meshColor[0]),
      green: colors ? colors[i * 4 + 1] : toByte(meshColor[1]),
      blue: colors ? colors[i * 4 + 2] : toByte(meshColor[2]),
      alpha: colors ? colors[i * 4 + 3] : toByte(meshOpacity),
    };

    if (decodedNormals && decodedNormals.length >= (i + 1) * 3) {
      vertex.nx = decodedNormals[src];
      vertex.ny = decodedNormals[src + 1];
      vertex.nz = decodedNormals[src + 2];
    }
    if (uvs && uvs.length >= (i + 1) * 2) {
      vertex.s = uvs[i * 2];
      vertex.t = uvs[i * 2 + 1];
    }
    vertices.push(vertex);
  }

  if (geometry.primitive === TrianglesPrimitive) {
    const indices = geometry.indices;
    if (indices && indices.length > 0) {
      for (let i = 0; i < indices.length; i += 3) {
        faces.push([
          vertexOffset + indices[i],
          vertexOffset + indices[i + 1],
          vertexOffset + indices[i + 2],
        ]);
      }
    } else {
      for (let i = 0; i < vertexCount; i += 3) {
        faces.push([vertexOffset + i, vertexOffset + i + 1, vertexOffset + i + 2]);
      }
    }
  }
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round((value ?? 1) * 255)));
}

function formatNum(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number(value.toFixed(9)).toString();
}
