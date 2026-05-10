import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {ChunkWriter} from "./chunkWriter";
import {RVMPrimitive} from "./RVMPrimitive";
import {yieldToHost} from "../../../../utils";
import type {LoaderProgress} from "../../../LoaderProgress";

/**
 * Encode a SceneModel as a minimal RVM v2 file.
 *
 * RVM is primarily a *plant-design output* format — most pipelines
 * convert OUT of RVM, not into it — so this encoder is intentionally
 * limited. It writes:
 *
 *   - A standard HEAD / MODL header.
 *   - One CNTB per `SceneObject`, named with the object's id.
 *   - One PRIM per `SceneMesh`. The primitive payload is always Box
 *     and the box dimensions are taken from the geometry's AABB. This
 *     means real triangle meshes are emitted as their bounding boxes
 *     in the RVM — a common-denominator round-trip that AVEVA / E3D
 *     can ingest, but which discards detail.
 *   - A trailing END chunk.
 *
 * What's missing (TODO):
 *   - Detection of geometry that originated as a real RVM primitive
 *     (cylinder / sphere / snout / ...) so we can emit the correct
 *     primitive kind instead of a fallback box.
 *   - The paired `.attr` file with object hierarchy + properties.
 *   - FacetGroup output for non-primitive geometry.
 *
 * Length values are written in millimetres (RVM convention) — every
 * SceneModel coordinate is multiplied by 1000 on the way out.
 *
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw new Error("[RVMExporter] SceneModel is required");
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

  const writer = new ChunkWriter();

  // ── HEAD ─────────────────────────────────────────────────────────
  writer.writeChunkHeader("HEAD", 1);
  writer.writeString("xeokit-sdk");                  // info
  writer.writeString("");                            // note
  writer.writeString(new Date().toISOString());      // date
  writer.writeString("xeokit");                      // user
  writer.writeString("UTF-8");                       // encoding

  // ── MODL ─────────────────────────────────────────────────────────
  writer.writeChunkHeader("MODL", 1);
  writer.writeString(sceneModel.id || "model");      // project
  writer.writeString(sceneModel.id || "model");      // name

  // ── Walk objects → CNTB / PRIM ───────────────────────────────────
  const objects = Object.values(sceneModel.objects) as any[];
  for (let oi = 0; oi < objects.length; oi++) {
    if ((oi & 0x1F) === 0) await step("Encoding RVM", oi, objects.length);
    const obj = objects[oi];
    writer.writeChunkHeader("CNTB", 1);
    writer.writeString(obj.id);
    writer.writeFloat32(0); // tx
    writer.writeFloat32(0); // ty
    writer.writeFloat32(0); // tz
    writer.writeInt32(0);   // materialId

    for (const mesh of obj.meshes) {
      const aabb = mesh.geometry?.aabb;
      if (!aabb) continue;
      const xLen = Math.max(0.001, aabb[3] - aabb[0]) * 1000;
      const yLen = Math.max(0.001, aabb[4] - aabb[1]) * 1000;
      const zLen = Math.max(0.001, aabb[5] - aabb[2]) * 1000;
      const cx = (aabb[0] + aabb[3]) * 0.5 * 1000;
      const cy = (aabb[1] + aabb[4]) * 0.5 * 1000;
      const cz = (aabb[2] + aabb[5]) * 0.5 * 1000;

      writer.writeChunkHeader("PRIM", 1);
      writer.writeUint32(RVMPrimitive.Box);

      // 12-float column-major modelling matrix — identity rotation +
      // scale, translation = AABB centre (mm).
      writer.writeFloat32(1); writer.writeFloat32(0); writer.writeFloat32(0);
      writer.writeFloat32(0); writer.writeFloat32(1); writer.writeFloat32(0);
      writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(1);
      writer.writeFloat32(cx); writer.writeFloat32(cy); writer.writeFloat32(cz);

      // 6-float bounding box — same AABB (mm).
      writer.writeFloat32(aabb[0] * 1000); writer.writeFloat32(aabb[1] * 1000); writer.writeFloat32(aabb[2] * 1000);
      writer.writeFloat32(aabb[3] * 1000); writer.writeFloat32(aabb[4] * 1000); writer.writeFloat32(aabb[5] * 1000);

      // Box payload: full extents (mm).
      writer.writeFloat32(xLen);
      writer.writeFloat32(yLen);
      writer.writeFloat32(zLen);
    }

    // CNTE — preamble only, no payload.
    writer.writeChunkHeader("CNTE", 1);
  }

  // ── END ──────────────────────────────────────────────────────────
  writer.writeChunkHeader("END", 1);

  await step("Encoding RVM", objects.length, objects.length);
  return writer.finish();
}
