import {TrianglesPrimitive} from "../../../../../../base/constants";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {type RenderBins, RenderBinClassifier} from "../RenderBinClassifier";
import type {MeshBatch} from "../../meshManager/MeshBatch";
import type {View} from "../../../../../viewer";

function createBins(): RenderBins {
  return {
    normalDrawOpaque: [],
    normalDrawSAO: [],
    normalDrawShadow: [],
    normalDrawSAOShadow: [],
    normalShadowTransparent: [],
    normalEdgesOpaque: [],
    normalFillTransparent: [],
    normalEdgesTransparent: [],
    styleBinFillOpaque: [],
    styleBinOverlayOpaque: [],
    styleBinEdgesOpaque: [],
    styleBinFillTransparent: [],
    styleBinOverlayTransparent: [],
    styleBinEdgesTransparent: []
  };
}

describe("RenderBinClassifier VBO edges", () => {
  it("routes VBO triangle batches into edge bins when edges are active", () => {
    const batch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      hasStyleBinClearDepthBefore: () => false,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE
    } as unknown as MeshBatch;
    const view = {
      effects: {
        edges: {applied: true}
      }
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

  it("routes transparent triangle batches to transparent color and shadow-depth bins", () => {
    const batch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: true,
      shadowsSupported: true,
      hasStyleBinClearDepthBefore: () => false,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.TRANSPARENT
    } as unknown as MeshBatch;
    const view = {
      effects: {
        edges: {applied: false}
      }
    } as unknown as View;
    const bins = createBins();

    new RenderBinClassifier().classify({
      meshBatches: [batch],
      view,
      viewIndex: 0,
      bins,
      flags: {
        drawWithSAO: true,
        drawWithShadows: true
      }
    });

    expect(bins.normalFillTransparent).toEqual([batch]);
    expect(bins.normalShadowTransparent).toEqual([batch]);
    expect(bins.normalDrawShadow).toEqual([]);
    expect(bins.normalDrawSAOShadow).toEqual([]);
  });

  it("routes arbitrary style-bin passes to generic style-bin bins", () => {
    const opaqueStyleBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: true,
      shadowsSupported: true,
      hasStyleBinClearDepthBefore: () => false,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.STYLE_BIN_OPAQUE
    } as unknown as MeshBatch;
    const transparentStyleBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "dtx",
      saoSupported: true,
      shadowsSupported: true,
      hasStyleBinClearDepthBefore: () => false,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.STYLE_BIN_TRANSPARENT
    } as unknown as MeshBatch;
    const view = {
      effects: {
        edges: {applied: false}
      }
    } as unknown as View;
    const bins = createBins();

    new RenderBinClassifier().classify({
      meshBatches: [opaqueStyleBatch, transparentStyleBatch],
      view,
      viewIndex: 0,
      bins,
      flags: {
        drawWithSAO: true,
        drawWithShadows: true
      }
    });

    expect(bins.styleBinFillOpaque).toEqual([opaqueStyleBatch]);
    expect(bins.styleBinEdgesOpaque).toEqual([opaqueStyleBatch]);
    expect(bins.styleBinFillTransparent).toEqual([transparentStyleBatch]);
    expect(bins.styleBinEdgesTransparent).toEqual([transparentStyleBatch]);
    expect(bins.normalDrawSAOShadow).toEqual([]);
    expect(bins.normalShadowTransparent).toEqual([]);
  });

  it("routes clearDepthBefore style-bin meshes to overlay bins without changing their normal pass", () => {
    const batch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: true,
      shadowsSupported: false,
      hasStyleBinClearDepthBefore: () => true,
      hasMeshesInRenderPass: (_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE
    } as unknown as MeshBatch;
    const view = {
      effects: {
        edges: {applied: false}
      }
    } as unknown as View;
    const bins = createBins();

    new RenderBinClassifier().classify({
      meshBatches: [batch],
      view,
      viewIndex: 0,
      bins,
      flags: {
        drawWithSAO: true,
        drawWithShadows: false
      }
    });

    expect(bins.normalDrawSAO).toEqual([batch]);
    expect(bins.styleBinOverlayOpaque).toEqual([batch]);
    expect(bins.styleBinFillOpaque).toEqual([]);
  });

  it("skips batches suppressed by representation membership", () => {
    const suppressedBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      lodRepMemberships: [{selectionId: "model:floor3", repIds: ["detailed"]}],
      hasStyleBinClearDepthBefore: () => false,
      hasMeshesInRenderPass: jest.fn((_viewIndex: number, renderPass: number) => renderPass === RENDER_PASSES.OPAQUE)
    } as unknown as MeshBatch;
    const visibleBatch = {
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo",
      saoSupported: false,
      shadowsSupported: false,
      lodRepMemberships: [{selectionId: "model:floor3", repIds: ["dominant"]}],
      hasStyleBinClearDepthBefore: () => false,
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
      }
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
