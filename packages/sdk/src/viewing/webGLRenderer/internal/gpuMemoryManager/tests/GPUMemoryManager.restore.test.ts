import {GPUMemoryManager} from "../GPUMemoryManager";
import type {SDKResult} from "../../../../../base/core";

/**
 * Regression test for GPUMemoryManager.webglContextRestored(): it must forward
 * the restore to every context user — both per-view matrix textures AND every
 * GPUMemoryBatch. A previous version iterated the arrays with `for...in` (which
 * yields index strings, not the objects) and included the batches array as a
 * single un-spread element, so nothing was actually restored after a WebGL
 * context loss.
 *
 * The restore method only walks the three private arrays, so the GL-backed
 * constructor/init is not needed — fakes are injected directly.
 */

interface FakeUser {
  restoreCalls: number;
  uploadCalls: number;
  gl: unknown;
  setContextCalls: unknown[];
  setWebGLContext(gl: unknown): void;
  webglContextRestored(): SDKResult<void>;
  uploadChanges(): void;
}

function fakeUser(result: SDKResult<void> = {ok: true, value: undefined}): FakeUser {
  return {
    restoreCalls: 0,
    uploadCalls: 0,
    gl: null,
    setContextCalls: [],
    setWebGLContext(gl) {
      this.gl = gl;
      this.setContextCalls.push(gl);
    },
    webglContextRestored() {
      this.restoreCalls++;
      return result;
    },
    uploadChanges() {
      this.uploadCalls++;
    },
  };
}

function managerWith(
  cameraTextures: FakeUser[],
  pickTextures: FakeUser[],
  batches: FakeUser[],
  contextLost = false,
): GPUMemoryManager {
  const gl = {id: "restored-gl"};
  const renderContext = {
    contextLost,
    gl,
    memoryConfigs: {maxViews: Math.max(cameraTextures.length, pickTextures.length)},
  };
  const mgr = new GPUMemoryManager(renderContext as never);
  const m = mgr as unknown as Record<string, unknown>;
  m._viewTileCameraMatrixTexture = cameraTextures;
  m._viewTilePickMatrixTexture = pickTextures;
  m._batches = batches;
  return mgr;
}

describe("GPUMemoryManager.webglContextRestored", () => {

  it("restores every matrix texture and every batch exactly once", () => {
    const camera = [fakeUser(), fakeUser()];
    const pick = [fakeUser(), fakeUser()];
    const batches = [fakeUser(), fakeUser(), fakeUser()];

    const result = managerWith(camera, pick, batches).webglContextRestored();

    expect(result.ok).toBe(true);
    for (const user of [...camera, ...pick, ...batches]) {
      expect(user.restoreCalls).toBe(1);
      expect(user.setContextCalls).toEqual([{id: "restored-gl"}]);
    }
  });

  it("restores batches even when there are no extra views", () => {
    const batches = [fakeUser(), fakeUser()];

    managerWith([fakeUser()], [fakeUser()], batches).webglContextRestored();

    expect(batches.every(b => b.restoreCalls === 1)).toBe(true);
  });

  it("propagates the first failing restore and stops", () => {
    const camera = [fakeUser()];
    const failing = fakeUser({ok: false, type: 0 as never, error: "restore failed"});
    const after = fakeUser();

    const result = managerWith(camera, [], [failing, after]).webglContextRestored();

    expect(result.ok).toBe(false);
    expect((result as {error: string}).error).toBe("restore failed");
    expect(after.restoreCalls).toBe(0);
  });
});

describe("GPUMemoryManager.uploadChanges context-loss gating", () => {

  it("uploads matrix textures and batches when the context is live", () => {
    const camera = [fakeUser()];
    const pick = [fakeUser()];
    const batches = [fakeUser(), fakeUser()];

    managerWith(camera, pick, batches, false).uploadChanges();

    for (const user of [...camera, ...pick, ...batches]) {
      expect(user.uploadCalls).toBe(1);
    }
  });

  it("skips all GPU uploads while the context is lost", () => {
    const camera = [fakeUser()];
    const pick = [fakeUser()];
    const batches = [fakeUser(), fakeUser()];

    managerWith(camera, pick, batches, true).uploadChanges();

    for (const user of [...camera, ...pick, ...batches]) {
      expect(user.uploadCalls).toBe(0);
    }
  });
});
