import type {InstancedDrawBatch} from "./InstancedDrawBatch";

export interface InstancedDrawBatches {
  opaque: InstancedDrawBatch[];
  edges: InstancedDrawBatch[];
  transparent: InstancedDrawBatch[];
  overlayOpaque: InstancedDrawBatch[];
  overlayTransparent: InstancedDrawBatch[];
  xrayedOpaque: InstancedDrawBatch[];
  xrayedEdgesOpaque: InstancedDrawBatch[];
  xrayedTransparent: InstancedDrawBatch[];
  xrayedEdgesTransparent: InstancedDrawBatch[];
  highlightedOpaque: InstancedDrawBatch[];
  highlightedEdgesOpaque: InstancedDrawBatch[];
  highlightedTransparent: InstancedDrawBatch[];
  highlightedEdgesTransparent: InstancedDrawBatch[];
  selectedOpaque: InstancedDrawBatch[];
  selectedEdgesOpaque: InstancedDrawBatch[];
  selectedTransparent: InstancedDrawBatch[];
  selectedEdgesTransparent: InstancedDrawBatch[];
}
