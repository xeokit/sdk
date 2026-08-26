import {GaussianSplatsPrimitive, TrianglesPrimitive} from "../../../../../../base/constants";
import type {SceneMesh, SceneObject} from "../../../../../../model/scene";
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
    usesBatchLOD: jest.fn(() => false),
  };
}

describe("MeshManager object lifecycle", () => {
  test("registers existing scene model meshes before existing scene objects during init", () => {
    const sceneMesh = {
      uniqueId: "model__mesh",
      id: "mesh",
      model: {activeBatch: null},
      geometry: {primitive: TrianglesPrimitive},
    } as unknown as SceneMesh;
    const sceneObject = {
      id: "object-a",
      model: {activeBatch: null},
      meshes: [sceneMesh],
    } as unknown as SceneObject;
    const manager = createManager() as any;
    manager._renderContext.viewer.scene = {
      models: {
        model: {
          meshes: {
            mesh: sceneMesh,
          },
        },
      },
      objects: {
        "object-a": sceneObject,
      },
    };
    const calls: string[] = [];
    manager.sceneMeshesCreated = jest.fn(() => {
      calls.push("meshes");
      manager._rendererMeshes[sceneMesh.uniqueId] = createRendererMesh();
      return {ok: true, value: undefined};
    });
    const originalSceneObjectCreated = manager.sceneObjectCreated.bind(manager);
    manager.sceneObjectCreated = jest.fn((object: SceneObject) => {
      calls.push("object");
      return originalSceneObjectCreated(object);
    });

    expect(manager.init()).toEqual({ok: true, value: undefined});
    expect(calls).toEqual(["meshes", "object"]);
  });

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

  test("syncs LOD visibility from deltas instead of scanning every renderer object", () => {
    const manager = createManager();
    const objectA = {setLODSuppressed: jest.fn()};
    const objectB = {setLODSuppressed: jest.fn()};
    const lodVisibility = {
      getViewVersion: jest.fn(() => 1),
      getSuppressionDeltasSince: jest.fn(() => ({
        fromVersion: 0,
        toVersion: 1,
        deltas: [
          {objectIds: ["object-a"], suppressed: true}
        ]
      })),
      isSuppressed: jest.fn()
    };
    manager._renderContext.viewer.lodVisibility = lodVisibility;
    manager._rendererObjects = {
      "object-a": objectA,
      "object-b": objectB
    };

    manager.syncLODVisibility({id: "view", viewIndex: 0} as any);

    expect(lodVisibility.getSuppressionDeltasSince).toHaveBeenCalledWith("view", 0);
    expect(objectA.setLODSuppressed).toHaveBeenCalledWith(0, true);
    expect(objectB.setLODSuppressed).not.toHaveBeenCalled();
    expect(lodVisibility.isSuppressed).not.toHaveBeenCalled();
  });

  test("syncs representation LOD objects through object state when renderer meshes are not LOD-batched", () => {
    const manager = createManager();
    const rendererMesh = createRendererMesh();
    const rendererObject = {setLODSuppressed: jest.fn()};
    const repSet = {
      id: "chunk-lod",
      model: {id: "model"},
      reps: {
        all: {objectIds: ["object-a"]},
        dominant: {objectIds: ["object-b"]}
      }
    };
    const model = {
      getRepSetsForObject: jest.fn(() => [repSet])
    };
    const sceneMesh = {
      uniqueId: "model__mesh",
    } as unknown as SceneMesh;
    const sceneObject = {
      id: "object-a",
      model,
      meshes: [sceneMesh],
    } as unknown as SceneObject;
    const lodVisibility = {
      getViewVersion: jest.fn(() => 1),
      getSuppressionDeltasSince: jest.fn(() => null),
      isSuppressed: jest.fn((_viewId: string, objectId: string) => objectId === "object-a")
    };
    manager._renderContext.viewer.lodVisibility = lodVisibility;
    manager._rendererObjects = {
      "object-a": rendererObject
    };

    manager._updateObjectLODFilterMode(sceneObject, [rendererMesh]);
    manager.syncLODVisibility({id: "view", viewIndex: 0} as any);

    expect(rendererMesh.usesBatchLOD).toHaveBeenCalled();
    expect(lodVisibility.isSuppressed).toHaveBeenCalledWith("view", "object-a");
    expect(rendererObject.setLODSuppressed).toHaveBeenCalledWith(0, true);
  });
});
