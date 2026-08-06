import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../../../base/constants";
import type {SceneMesh, SceneObject} from "../../../../../model/scene";
import {MeshManager} from "../MeshManager";

function createManager(numViews = 2) {
  const viewList = Array.from({length: numViews}, () => ({objects: {}}));
  return new MeshManager({
    memoryConfigs: {maxViews: numViews},
    viewer: {
      numViews,
      viewList,
    },
  } as any, {} as any) as any;
}

function createRendererMesh(numViews = 2) {
  const objectVisible = Array.from({length: numViews}, () => true);
  return {
    destroy: jest.fn(),
    isObjectVisible: jest.fn((viewIndex: number) => objectVisible[viewIndex]),
    setObjectVisible: jest.fn((viewIndex: number, visible: boolean) => {
      objectVisible[viewIndex] = visible;
    }),
    setXRayed: jest.fn(),
    setHighlighted: jest.fn(),
    setSelected: jest.fn(),
    setCulled: jest.fn(),
    setPickable: jest.fn(),
    setClippable: jest.fn(),
    setColorInView: jest.fn(),
    setOpacityInView: jest.fn(),
  };
}

describe("MeshManager object lifecycle", () => {
  test("keeps renderer meshes alive and resets stale object state when a scene mesh is reattached", () => {
    const manager = createManager();
    const rendererMesh = createRendererMesh();
    const sceneMesh = {
      uniqueId: "model__mesh",
      geometry: {primitive: TrianglesPrimitive},
    } as unknown as SceneMesh;
    const firstObject = {
      id: "object-a",
      meshes: [sceneMesh],
    } as unknown as SceneObject;
    const secondObject = {
      id: "object-b",
      meshes: [sceneMesh],
    } as unknown as SceneObject;

    manager._rendererMeshes[sceneMesh.uniqueId] = rendererMesh;

    expect(manager.sceneObjectCreated(firstObject).ok).toBe(true);
    expect(manager.sceneObjectDestroyed(firstObject).ok).toBe(true);

    expect(rendererMesh.destroy).not.toHaveBeenCalled();
    expect(manager._rendererMeshes[sceneMesh.uniqueId]).toBe(rendererMesh);
    expect(rendererMesh.setObjectVisible).toHaveBeenNthCalledWith(1, 0, false);
    expect(rendererMesh.setObjectVisible).toHaveBeenNthCalledWith(2, 1, false);

    expect(manager.sceneObjectCreated(secondObject).ok).toBe(true);

    expect(rendererMesh.setObjectVisible).toHaveBeenNthCalledWith(3, 0, true);
    expect(rendererMesh.setObjectVisible).toHaveBeenNthCalledWith(4, 1, true);
    expect(rendererMesh.setColorInView).toHaveBeenCalledWith(0, null);
    expect(rendererMesh.setColorInView).toHaveBeenCalledWith(1, null);
    expect(rendererMesh.setOpacityInView).toHaveBeenCalledWith(0, null);
    expect(rendererMesh.setOpacityInView).toHaveBeenCalledWith(1, null);
  });

  test("treats repeated renderer registration notifications as idempotent", () => {
    const manager = createManager();
    const rendererMesh = createRendererMesh();
    const rendererSplatMesh = {destroy: jest.fn()};
    const mesh = {
      uniqueId: "model__mesh",
      geometry: {primitive: TrianglesPrimitive},
    } as unknown as SceneMesh;
    const splatMesh = {
      uniqueId: "model__splat",
      geometry: {primitive: GaussianSplatsPrimitive},
    } as unknown as SceneMesh;
    const object = {
      id: "object-a",
      meshes: [mesh],
    } as unknown as SceneObject;

    manager._rendererMeshes[mesh.uniqueId] = rendererMesh;
    manager._rendererSplatMeshes[splatMesh.uniqueId] = rendererSplatMesh;

    expect(manager.sceneMeshCreated(mesh)).toEqual({ok: true, value: rendererMesh});
    expect(manager.sceneMeshCreated(splatMesh)).toEqual({ok: true, value: rendererSplatMesh});
    expect(manager.sceneObjectCreated(object).ok).toBe(true);
    expect(manager.sceneObjectCreated(object)).toEqual({ok: true, value: undefined});
  });
});
