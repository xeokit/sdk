import {ModelLoader} from "../ModelLoader";
import {createUUID, yieldToHost} from "../../base/utils";
import {PointsPrimitive} from "../../base/constants";
import {composeMat4, transformPoint3} from "../../base/math/matrix";
import {createVec3Float64} from "../../base/math/vector";
import type {Vec3} from "../../base/math/vector";
import type {ModelLoadParams} from "../ModelLoadParams";
import type {ModelParseParams} from "../ModelParseParams";
import type {LoaderProgress} from "../LoaderProgress";
import type {SceneModel} from "../../model/scene";
import type {E57LoaderOptions} from "./E57LoaderOptions";
import {readE57, decodeCompressedVector, type E57Columns, type E57PointCloud} from "./parser";

// Points + colours per SceneGeometry, matching the LAS loader's batching.
const MAX_VERTICES = 20000;

/**
 * Loads an E57 point cloud into a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel}.
 *
 * Each `data3D` scan becomes one {@link model!scene.SceneObject | SceneObject}
 * (so scans toggle independently); its points are placed by the scan pose,
 * stored relative to a per-scan RTC origin for precision, and batched into
 * {@link base!constants.PointsPrimitive | point} geometries.
 *
 * For detailed usage, refer to {@link e57 | @xeokit/sdk/formats/e57}.
 */
export class E57Loader extends ModelLoader {
  constructor() {
    super({
      format: "E57",
      fileDataType: "arraybuffer",
      parsers: {
        "*": parseE57Model,
      },
      getVersion: (): string => "*",
    });
  }

  load(params: ModelLoadParams, options: E57LoaderOptions = {}): Promise<any> {
    return super.load(params, options);
  }
}

async function parseE57Model(params: ModelParseParams, options: E57LoaderOptions = {}): Promise<void> {
  const {sceneModel, dataModel, fileData} = params;
  if (!sceneModel && !dataModel) {
    return;
  }
  const skip = Math.max(1, Math.floor(options.skip || 1));
  const log = (msg: string) => params.log && params.log(msg);
  const signal: AbortSignal | undefined = (options as any).signal;
  const onProgress: ((p: LoaderProgress) => void) | undefined = (options as any).onProgress;
  const progress: LoaderProgress = {phase: "Parsing E57", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) { progress.phase = phase; progress.current = current; progress.total = total; onProgress(progress); }
    await yieldToHost(signal);
  };

  await step("Parsing E57", 0, 0);
  let file;
  try {
    file = readE57(fileData);
  } catch (e) {
    throw new Error(`[E57Loader] Error parsing E57 -> ${(e as Error).message || e}`);
  }
  const {document, logical, header} = file;

  const rootId = createUUID();
  if (dataModel) {
    dataModel.createObject({id: rootId, type: "BasicEntity", name: "Model"});
  }

  const scans = document.pointClouds;
  for (let s = 0; s < scans.length; s++) {
    const pc = scans[s];
    await step(`Decoding scan ${s + 1} / ${scans.length}`, s, scans.length);
    const columns = decodeCompressedVector(logical, pc, header.pageSize);

    const objectId = sceneModel
      ? await buildScanObject(sceneModel, pc, columns, s, skip, options, log, step)
      : createUUID();

    if (dataModel && objectId) {
      dataModel.createObject({id: objectId, type: "BasicEntity", name: pc.name || `Scan ${s + 1}`});
      dataModel.createRelationship({type: "BasicAggregation", relatingObjectId: rootId, relatedObjectId: objectId});
    }
  }
  await step("Done", scans.length, scans.length);
}

/**
 * Builds one scan's SceneObject (geometries + meshes). Returns the object id, or
 * `null` when the scan yielded no usable points (e.g. spherical-only, or all
 * points invalid).
 */
async function buildScanObject(
  sceneModel: SceneModel,
  pc: E57PointCloud,
  columns: E57Columns,
  scanIndex: number,
  skip: number,
  options: E57LoaderOptions,
  log: (msg: string) => void,
  step: (phase: string, current: number, total: number) => Promise<void>,
): Promise<string | null> {
  const X = columns.get("cartesianX");
  const Y = columns.get("cartesianY");
  const Z = columns.get("cartesianZ");
  if (!X || !Y || !Z) {
    log(`[E57Loader] scan ${scanIndex} has no cartesian coordinates (spherical not supported in v1) — skipped`);
    return null;
  }
  const invalid = columns.get("cartesianInvalidState");
  const red = columns.get("colorRed");
  const green = columns.get("colorGreen");
  const blue = columns.get("colorBlue");
  const intensity = columns.get("intensity");
  const hasColor = !!(red && green && blue);
  const useIntensity = !hasColor && !!intensity && !!options.intensityAsColor;

  // Scan pose (E57 quaternion is [w, x, y, z]; the SDK uses [x, y, z, w]).
  let pose = null;
  if (pc.pose) {
    const r = pc.pose.rotation, t = pc.pose.translation;
    pose = composeMat4([t[0], t[1], t[2]], [r[1], r[2], r[3], r[0]], [1, 1, 1]);
  }

  const n = pc.recordCount;
  const isValid = (i: number) => !invalid || invalid[i] === 0;

  // Intensity normalisation range (across valid points), only when needed.
  let iMin = Infinity, iMax = -Infinity;
  if (useIntensity && intensity) {
    for (let i = 0; i < n; i++) {
      if (!isValid(i)) continue;
      const v = intensity[i];
      if (v < iMin) iMin = v;
      if (v > iMax) iMax = v;
    }
  }
  const iRange = iMax > iMin ? iMax - iMin : 1;

  // Single pass: pose-transform kept points into world space, accumulate the
  // centroid (used as the RTC origin), and gather colours.
  const positions: number[] = [];
  const colors: number[] = [];
  const p = createVec3Float64();
  let sx = 0, sy = 0, sz = 0, kept = 0;
  for (let i = 0; i < n; i++) {
    if (i % skip !== 0 || !isValid(i)) continue;
    p[0] = X[i]; p[1] = Y[i]; p[2] = Z[i];
    if (pose) transformPoint3(pose, p, p);
    positions.push(p[0], p[1], p[2]);
    sx += p[0]; sy += p[1]; sz += p[2];
    if (hasColor) {
      colors.push(red![i], green![i], blue![i], 255);
    } else if (useIntensity && intensity) {
      const g = Math.round(((intensity[i] - iMin) / iRange) * 255);
      colors.push(g, g, g, 255);
    } else {
      colors.push(255, 255, 255, 255);
    }
    kept++;
  }
  if (kept === 0) {
    log(`[E57Loader] scan ${scanIndex} has no valid points after filtering — skipped`);
    return null;
  }

  // RTC origin = centroid; store positions relative to it (double-precision
  // origin reconstructed by the renderer).
  const origin: Vec3 = createVec3Float64([sx / kept, sy / kept, sz / kept]);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= origin[0];
    positions[i + 1] -= origin[1];
    positions[i + 2] -= origin[2];
  }

  const objectId = createUUID();
  const meshIds: string[] = [];
  const chunks = Math.ceil(kept / MAX_VERTICES);
  for (let c = 0; c < chunks; c++) {
    await step(`Building scan ${scanIndex + 1}`, c, chunks);
    const from = c * MAX_VERTICES;
    const to = Math.min(from + MAX_VERTICES, kept);
    const geometryId = `scan-${scanIndex}-geometry-${c}`;
    const geometryResult = sceneModel.createGeometry({
      id: geometryId,
      primitive: PointsPrimitive,
      positions: positions.slice(from * 3, to * 3),
      colorsCompressed: new Uint8Array(colors.slice(from * 4, to * 4)),
    });
    if (geometryResult.ok === false) {
      log(`[E57Loader] cannot create geometry -> ${geometryResult.error}`);
      continue;
    }
    const meshId = `scan-${scanIndex}-mesh-${c}`;
    const meshResult = sceneModel.createMesh({id: meshId, geometryId, origin});
    if (meshResult.ok === false) {
      log(`[E57Loader] cannot create mesh -> ${meshResult.error}`);
      continue;
    }
    meshIds.push(meshId);
  }
  if (meshIds.length === 0) {
    return null;
  }
  sceneModel.createObject({id: objectId, meshIds, layerId: options.layerId});
  return objectId;
}
