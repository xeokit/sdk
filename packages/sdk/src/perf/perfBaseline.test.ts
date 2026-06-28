/**
 * Performance/scale baseline harness.
 *
 * Loads a representative model headlessly, captures deterministic
 * structural / memory / culling metrics (see {@link scenePerfMetrics}),
 * and diffs them against a committed baseline JSON. Structural and cull
 * metrics are asserted (a change is a regression to investigate); load
 * timing is reported but not asserted, since wall-clock varies by machine.
 *
 * Gated behind `RUN_PERF` so the normal test run skips it. Run it with:
 *
 *   RUN_PERF=1 pnpm --filter @xeokit/sdk sdk-perf
 *
 * Regenerate the baseline (after an intentional change) with:
 *
 *   RUN_PERF=1 UPDATE_PERF_BASELINE=1 pnpm --filter @xeokit/sdk sdk-perf
 *
 * GPU frame-time is out of scope here — it needs a real WebGL2 context
 * (a browser harness), which this Node/jest harness deliberately avoids.
 */

import * as fs from "fs";
import * as path from "path";
import {Scene} from "../model/scene/Scene";
import {Data} from "../model/data/Data";
import {XKTLoader} from "../formats/legacy/xkt/XKTLoader";
import {collectStructuralMetrics, runCullPass} from "./scenePerfMetrics";

const MODEL = path.resolve(__dirname, "../formats/legacy/xkt/tests/fixtures/Duplex.xkt");
const BASELINE_DIR = path.resolve(__dirname, "baselines");
const BASELINE = path.join(BASELINE_DIR, "Duplex.json");

const run = process.env.RUN_PERF ? describe : describe.skip;

run("perf baseline — Duplex.xkt", () => {

  it("matches the committed structural / memory / cull baseline", async () => {
    const bytes = fs.readFileSync(MODEL);
    const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const scene = new Scene();
    const sceneModel = scene.createModel({id: "duplex"}).value!;
    const dataModel = new Data().createModel({id: "duplex"}).value!;

    const t0 = performance.now();
    await new XKTLoader().load({fileData, sceneModel, dataModel}, {});
    const loadMs = Math.round((performance.now() - t0) * 10) / 10;

    const structural = collectStructuralMetrics(sceneModel);
    const cull = runCullPass(scene);
    const current = {structural, cull, timings: {loadMs}};

    if (!fs.existsSync(BASELINE) || process.env.UPDATE_PERF_BASELINE) {
      fs.mkdirSync(BASELINE_DIR, {recursive: true});
      fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
      console.log(`[perf] wrote baseline ${BASELINE}\n`, current);
      return;
    }

    const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    console.log(
      `[perf] Duplex load ${loadMs}ms (baseline ${baseline.timings?.loadMs}ms) — ` +
      `${structural.numObjects} objects, ${structural.instancedTriangles} tris, ` +
      `reuse ${structural.geometryReuseRatio}x, ` +
      `${(structural.compressedGeometryBytes / 1024 / 1024).toFixed(2)}MB geom, ` +
      `cull ${cull.culled}/${cull.items}`,
    );

    // Deterministic metrics — a change is a real regression, not jitter.
    expect(structural).toEqual(baseline.structural);
    expect(cull).toEqual(baseline.cull);
  });
});
