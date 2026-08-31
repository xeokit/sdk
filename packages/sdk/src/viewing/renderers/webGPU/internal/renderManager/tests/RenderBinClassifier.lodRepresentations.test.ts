import {TrianglesPrimitive} from "../../../../../../base/constants";
import type {View} from "../../../../../viewer";
import {createMemoryConfigs} from "../../../createMemoryConfigs";
import type {TriangleBatchSegment, TriangleBatchSet} from "../../gpuMemoryManager";
import type {MeshManager, RendererMesh} from "../../meshManager";
import type {RenderBins} from "../../renderState";
import {RenderBinClassifier} from "../RenderBinClassifier";

function createBins(): RenderBins {
  return {
    normalDrawOpaque: [],
    normalEdgesOpaque: [],
    normalFillTransparent: [],
    styleBinFillOpaque: [],
    styleBinEdgesOpaque: [],
    styleBinFillTransparent: [],
    styleBinEdgesTransparent: []
  };
}

function createMeshState(id: string): RendererMesh {
  return {
    mesh: {
      uniqueId: id,
      bin: ""
    },
    geometryState: {
      edgeIndexCount: 0
    }
  } as unknown as RendererMesh;
}

function createSegment(key: string, meshState: RendererMesh, suppressed: boolean): TriangleBatchSegment {
  return {
    key,
    primitive: TrianglesPrimitive,
    slots: [{
      meshState
    }],
    lodRepMemberships: [{
      selectionId: "model:floor3",
      repIds: [suppressed ? "detailed" : "shell"]
    }]
  } as unknown as TriangleBatchSegment;
}

describe("WebGPU RenderBinClassifier representation LOD", () => {
  it("skips suppressed representation segments before per-mesh visibility checks", () => {
    const suppressedMesh = createMeshState("suppressedMesh");
    const visibleMesh = createMeshState("visibleMesh");
    const suppressedSegment = createSegment("suppressed", suppressedMesh, true);
    const visibleSegment = createSegment("visible", visibleMesh, false);
    const batchSet = {
      segments: [suppressedSegment, visibleSegment]
    } as unknown as TriangleBatchSet;
    const view = {
      id: "view"
    } as unknown as View;
    const meshManager = {
      isLODRepMembershipSuppressedInView: jest.fn((memberships) => memberships === suppressedSegment.lodRepMemberships),
      isMeshVisibleInView: jest.fn((meshState) => meshState === visibleMesh),
      getMeshOpacityInView: jest.fn(() => 1),
      getMeshDrawStyleInView: jest.fn(() => ({
        opacity: 1,
        alphaMode: 0,
        drawEdges: false,
        styleBinId: null
      }))
    } as unknown as MeshManager;
    const bins = createBins();

    const classifier = new RenderBinClassifier(createMemoryConfigs({
      grossMemoryMB: 512,
      device: "medium",
      utilization: 0.5
    }));
    classifier.classifySegments({
      batchSet,
      view,
      meshManager,
      bins,
      cameraCulling: false
    });

    expect(meshManager.isLODRepMembershipSuppressedInView).toHaveBeenCalledWith(suppressedSegment.lodRepMemberships, view);
    expect(meshManager.isMeshVisibleInView).not.toHaveBeenCalledWith(suppressedMesh, view);
    expect(meshManager.isMeshVisibleInView).toHaveBeenCalledWith(visibleMesh, view);
    expect(bins.normalDrawOpaque.map((item) => item.meshState)).toEqual([visibleMesh]);
    expect(classifier.stats.segmentCandidates).toBe(2);
    expect(classifier.stats.segmentFullyDrawn).toBe(1);
    expect(classifier.stats.segmentPartiallyRefined).toBe(0);
  });

  it("does not route fully opaque BLEND materials through the opaque segment fast path", () => {
    const blendMesh = createMeshState("blendMesh");
    const blendSegment = createSegment("blend", blendMesh, false);
    const batchSet = {
      segments: [blendSegment],
      segmentByMeshId: {
        [blendMesh.mesh.uniqueId]: blendSegment
      }
    } as unknown as TriangleBatchSet;
    const view = {
      id: "view"
    } as unknown as View;
    const meshManager = {
      isLODRepMembershipSuppressedInView: jest.fn(() => false),
      isMeshVisibleInView: jest.fn(() => true),
      getMeshOpacityInView: jest.fn(() => 1),
      getMeshDrawStyleInView: jest.fn(() => ({
        opacity: 1,
        alphaMode: 2,
        drawEdges: false,
        styleBinId: null
      })),
      getMeshViewDepth: jest.fn(() => -10)
    } as unknown as MeshManager;
    const bins = createBins();

    const classifier = new RenderBinClassifier(createMemoryConfigs({
      grossMemoryMB: 512,
      device: "medium",
      utilization: 0.5
    }));
    classifier.classifySegments({
      batchSet,
      view,
      meshManager,
      bins,
      cameraCulling: false
    });

    expect(bins.normalDrawOpaque).toHaveLength(0);
    expect(bins.normalFillTransparent.map((item) => item.meshState)).toEqual([blendMesh]);
    expect(classifier.stats.segmentFullyDrawn).toBe(0);
    expect(classifier.stats.segmentPartiallyRefined).toBe(1);
  });
});
