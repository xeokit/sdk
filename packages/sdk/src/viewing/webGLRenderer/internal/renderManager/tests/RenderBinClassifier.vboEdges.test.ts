import {TrianglesPrimitive} from "../../../../../base/constants";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {type RenderBins, RenderBinClassifier} from "../RenderBinClassifier";
import type {MeshBatch} from "../../meshManager/MeshBatch";
import type {View} from "../../../../viewer";

function createBins(): RenderBins {
  return {
    normalDrawOpaque: [],
    normalDrawSAO: [],
    normalDrawShadow: [],
    normalDrawSAOShadow: [],
    normalEdgesOpaque: [],
    normalFillTransparent: [],
    normalEdgesTransparent: [],
    xrayedSilhouetteOpaque: [],
    xrayEdgesOpaque: [],
    xrayedSilhouetteTransparent: [],
    xrayEdgesTransparent: [],
    highlightedSilhouetteOpaque: [],
    highlightedEdgesOpaque: [],
    highlightedSilhouetteTransparent: [],
    highlightedEdgesTransparent: [],
    selectedSilhouetteOpaque: [],
    selectedEdgesOpaque: [],
    selectedSilhouetteTransparent: [],
    selectedEdgesTransparent: []
  };
}

describe("RenderBinClassifier VBO edges", () => {
  it("routes VBO triangle batches into edge bins when edges are active", () => {
    const batch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE
    } as unknown as MeshBatch;
    const view = {
      effects: {
        edges: {applied: true}
      },
      xrayMaterial: {fill: false, edges: false, edgeAlpha: 0},
      highlightMaterial: {fill: false, edges: false, edgeAlpha: 0},
      selectedMaterial: {fill: false, edges: false, edgeAlpha: 0}
    } as unknown as View;
    const bins = createBins();

    new RenderBinClassifier().classify({
      meshBatches: [batch],
      view,
      viewIndex: 0,
      bins,
      flags: {
        drawWithSAO: false,
        drawWithShadows: false
      }
    });

    expect(bins.normalDrawOpaque).toEqual([batch]);
    expect(bins.normalEdgesOpaque).toEqual([batch]);
  });

  it("skips batches suppressed by representation membership", () => {
    const suppressedBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      lodRepMemberships: [{selectionId: "model:floor3", repIds: ["detailed"]}],
      hasMeshesInRenderPass: jest.fn((_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE)
    } as unknown as MeshBatch;
    const visibleBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      lodRepMemberships: [{selectionId: "model:floor3", repIds: ["dominant"]}],
      hasMeshesInRenderPass: jest.fn((_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE)
    } as unknown as MeshBatch;
    const lodVisibility = {
      isRepMembershipSuppressed: jest.fn((_viewId: string, memberships) => memberships === suppressedBatch.lodRepMemberships)
    };
    const view = {
      id: "view",
      viewer: {lodVisibility},
      effects: {
        edges: {applied: true}
      },
      xrayMaterial: {fill: false, edges: false, edgeAlpha: 0},
      highlightMaterial: {fill: false, edges: false, edgeAlpha: 0},
      selectedMaterial: {fill: false, edges: false, edgeAlpha: 0}
    } as unknown as View;
    const bins = createBins();

    new RenderBinClassifier().classify({
      meshBatches: [suppressedBatch, visibleBatch],
      view,
      viewIndex: 0,
      bins,
      flags: {
        drawWithSAO: false,
        drawWithShadows: false
      }
    });

    expect(lodVisibility.isRepMembershipSuppressed).toHaveBeenCalledWith("view", suppressedBatch.lodRepMemberships);
    expect((suppressedBatch as any).hasMeshesInRenderPass).not.toHaveBeenCalled();
    expect((visibleBatch as any).hasMeshesInRenderPass).toHaveBeenCalled();
    expect(bins.normalDrawOpaque).toEqual([visibleBatch]);
    expect(bins.normalEdgesOpaque).toEqual([visibleBatch]);
  });

});
