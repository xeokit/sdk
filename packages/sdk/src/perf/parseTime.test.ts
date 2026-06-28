/**
 * Main-thread parse-time measurement, to size up worker-offloaded loading.
 *
 * Loads HolterTower's XGF headlessly and breaks the cost into:
 *   - unpack  — binary → typed arrays (`unpackXGF`), pure CPU, fully offloadable
 *   - build   — `xgfToModel` creating SceneModel geometry/meshes/objects, which
 *               touches the main-thread Scene (≈ total − unpack)
 *   - total   — `XGFLoader.load()`, the whole main-thread blocking cost
 *
 * Measurement only (no baseline assertion). Gated behind RUN_PERF:
 *   RUN_PERF=1 pnpm --filter @xeokit/sdk sdk-perf
 */

import * as fs from "fs";
import * as path from "path";
import {Scene} from "../model/scene/Scene";
import {Data} from "../model/data/Data";
import {XGFLoader} from "../formats/xgf/XGFLoader";
import {unpackXGF} from "../formats/xgf/versions/v1/unpackXGF";

const MODEL = path.resolve(process.cwd(), "../website/models/HolterTower/xgf/model.xgf");
const run = process.env.RUN_PERF && fs.existsSync(MODEL) ? describe : describe.skip;

const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[xs.length >> 1];

run("parse time — HolterTower.xgf", () => {

  it("breaks main-thread parse into unpack vs SceneModel build", async () => {
    const bytes = fs.readFileSync(MODEL);
    const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const sizeMB = bytes.length / 1024 / 1024;

    // unpack only — pure binary decode, no Scene.
    const unpackRuns: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      unpackXGF(fileData);
      unpackRuns.push(performance.now() - t);
    }
    const unpackMs = median(unpackRuns);

    // full load — unpack + SceneModel build (+ DataModel). Fresh scene each run.
    let objects = 0;
    const totalRuns: number[] = [];
    for (let i = 0; i < 3; i++) {
      const scene = new Scene();
      const sceneModel = scene.createModel({id: `holter${i}`}).value!;
      const dataModel = new Data().createModel({id: `holter${i}`}).value!;
      const t = performance.now();
      await new XGFLoader().load({fileData, sceneModel, dataModel}, {});
      totalRuns.push(performance.now() - t);
      objects = Object.keys(sceneModel.objects).length;
    }
    const totalMs = median(totalRuns);
    const buildMs = Math.max(0, totalMs - unpackMs);

    console.log(
      `[perf] HolterTower.xgf parse — ${sizeMB.toFixed(1)}MB, ${objects} objects\n` +
      `  total load  ${totalMs.toFixed(0)}ms  (main-thread blocking)\n` +
      `  unpack      ${unpackMs.toFixed(0)}ms  (${((unpackMs / totalMs) * 100).toFixed(0)}% — offloadable to a worker)\n` +
      `  build       ${buildMs.toFixed(0)}ms  (${((buildMs / totalMs) * 100).toFixed(0)}% — SceneModel construction)`,
    );

    expect(totalMs).toBeGreaterThan(0);
  });

  it("splits the SceneModel build into Scene-API time vs decompression/prep", async () => {
    const bytes = fs.readFileSync(MODEL);
    const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    // Wrap the Scene/Data create* methods to accumulate their self-time. The
    // remainder of load() is xgfToModel's own work (geometry decompression,
    // per-object array slicing, loop overhead) — the part a worker could do.
    const wrap = (obj: any, methods: string[], acc: Record<string, number>) => {
      for (const m of methods) {
        if (typeof obj[m] !== "function") continue;
        const orig = obj[m].bind(obj);
        acc[m] ??= 0;
        obj[m] = (...args: any[]) => {
          const t = performance.now();
          const r = orig(...args);
          acc[m] += performance.now() - t;
          return r;
        };
      }
    };

    const acc: Record<string, number> = {};
    const scene = new Scene();
    const sceneModel = scene.createModel({id: "holterSplit"}).value!;
    const dataModel = new Data().createModel({id: "holterSplit"}).value!;
    wrap(sceneModel, ["createGeometryCompressed", "createGeometry", "createMesh", "createObject", "createTexture", "createMaterial", "createTransform"], acc);
    wrap(dataModel, ["createObject", "createRelationship", "createPropertySet"], acc);

    const t = performance.now();
    await new XGFLoader().load({fileData, sceneModel, dataModel}, {});
    const totalMs = performance.now() - t;

    const sceneApiMs = Object.values(acc).reduce((s, v) => s + v, 0);
    const prepMs = Math.max(0, totalMs - sceneApiMs);
    const pc = (v: number) => `${((v / totalMs) * 100).toFixed(0)}%`;

    const byMethod = Object.entries(acc)
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([m, v]) => `${m} ${v.toFixed(0)}ms (${pc(v)})`)
      .join(", ");

    console.log(
      `[perf] HolterTower.xgf build split — total ${totalMs.toFixed(0)}ms\n` +
      `  Scene/Data API   ${sceneApiMs.toFixed(0)}ms (${pc(sceneApiMs)}) — main-thread only\n` +
      `  decompression/prep ${prepMs.toFixed(0)}ms (${pc(prepMs)}) — worker-offloadable\n` +
      `  by method: ${byMethod}`,
    );

    expect(totalMs).toBeGreaterThan(0);
  });
});
