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
});
