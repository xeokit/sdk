import type {InstancedDrawBatch} from "./InstancedDrawBatch";

export interface InstancedDrawBatches {
  opaque: InstancedDrawBatch[];
  edges: InstancedDrawBatch[];
  transparent: InstancedDrawBatch[];
  overlayOpaque: InstancedDrawBatch[];
  overlayTransparent: InstancedDrawBatch[];
  styleBinOpaque: InstancedDrawBatch[];
  styleBinEdgesOpaque: InstancedDrawBatch[];
  styleBinTransparent: InstancedDrawBatch[];
  styleBinEdgesTransparent: InstancedDrawBatch[];
}
