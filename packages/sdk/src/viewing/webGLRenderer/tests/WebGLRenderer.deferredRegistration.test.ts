/**
 * @jest-environment jsdom
 */

import {SDKErrorType} from "../../../base/core";
import type {SceneGeometry, SceneMesh, SceneModel, SceneObject} from "../../../model/scene";

jest.mock("../internal/ViewManager", () => ({ViewManager: jest.fn()}));
jest.mock("../internal/webGL", () => ({getWebGLExtension: jest.fn()}));
jest.mock("../internal/inspectors", () => ({
  ShaderInspector: class {},
  RenderInspector: class {},
}));

import {WebGLRenderer} from "../WebGLRenderer";

function ok() {
  return {ok: true, value: undefined};
}

function createModel(building: boolean): SceneModel {
  return {
    building,
    geometries: {},
    meshes: {},
    objects: {},
  } as unknown as SceneModel;
}

function createModelEntries(model: SceneModel) {
  const geometry = {
    id: "geometry",
    model,
    destroyed: false,
  } as unknown as SceneGeometry;
  const mesh = {
    id: "mesh",
    model,
    destroyed: false,
  } as unknown as SceneMesh;
  const object = {
    id: "object",
    model,
    destroyed: false,
  } as unknown as SceneObject;

  model.geometries[geometry.id] = geometry;
  model.meshes[mesh.id] = mesh;
  model.objects[object.id] = object;

  return {geometry, mesh, object};
}

function createViewManager(calls: string[]) {
  return {
    sceneGeometryCreated: jest.fn((geometry: SceneGeometry) => {
      calls.push(`geometry:${geometry.id}`);
      return ok();
    }),
    sceneMeshCreated: jest.fn((mesh: SceneMesh) => {
      calls.push(`mesh:${mesh.id}`);
      return ok();
    }),
    sceneObjectCreated: jest.fn((object: SceneObject) => {
      calls.push(`object:${object.id}`);
      return ok();
    }),
  };
}

describe("WebGLRenderer deferred scene registration", () => {
  test("defers building-model creation and flushes in dependency order", () => {
    const renderer = new WebGLRenderer() as any;
    const model = createModel(true);
    const {geometry, mesh, object} = createModelEntries(model);
    const calls: string[] = [];
    const viewManager = createViewManager(calls);

    expect(renderer._deferSceneObjectCreated(object)).toBe(true);
    expect(renderer._deferSceneMeshCreated(mesh)).toBe(true);
    expect(renderer._deferSceneGeometryCreated(geometry)).toBe(true);

    renderer._flushDeferredSceneModelRegistrations(model, viewManager);

    expect(calls).toEqual([
      "geometry:geometry",
      "mesh:mesh",
      "object:object",
    ]);

    renderer._flushDeferredSceneModelRegistrations(model, viewManager);

    expect(viewManager.sceneGeometryCreated).toHaveBeenCalledTimes(1);
    expect(viewManager.sceneMeshCreated).toHaveBeenCalledTimes(1);
    expect(viewManager.sceneObjectCreated).toHaveBeenCalledTimes(1);
  });

  test("does not defer non-building models", () => {
    const renderer = new WebGLRenderer() as any;
    const model = createModel(false);
    const {geometry, mesh, object} = createModelEntries(model);

    expect(renderer._deferSceneGeometryCreated(geometry)).toBe(false);
    expect(renderer._deferSceneMeshCreated(mesh)).toBe(false);
    expect(renderer._deferSceneObjectCreated(object)).toBe(false);
  });

  test("discarded or stale deferred entries are not flushed", () => {
    const renderer = new WebGLRenderer() as any;
    renderer.logging = false;
    const model = createModel(true);
    const {geometry, mesh, object} = createModelEntries(model);
    const calls: string[] = [];
    const viewManager = createViewManager(calls);
    viewManager.sceneMeshCreated.mockReturnValueOnce({
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "should not be logged because stale meshes are skipped",
    });

    expect(renderer._deferSceneGeometryCreated(geometry)).toBe(true);
    expect(renderer._deferSceneMeshCreated(mesh)).toBe(true);
    expect(renderer._deferSceneObjectCreated(object)).toBe(true);

    expect(renderer._discardDeferredSceneObject(object)).toBe(true);
    delete model.meshes[mesh.id];

    renderer._flushDeferredSceneModelRegistrations(model, viewManager);

    expect(calls).toEqual(["geometry:geometry"]);
    expect(viewManager.sceneMeshCreated).not.toHaveBeenCalled();
    expect(viewManager.sceneObjectCreated).not.toHaveBeenCalled();
  });
});
