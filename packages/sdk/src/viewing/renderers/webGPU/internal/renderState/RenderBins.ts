import type {DrawItem} from "./DrawItem";

export interface RenderBins {
  normalDrawOpaque: DrawItem[];
  normalEdgesOpaque: DrawItem[];
  normalFillTransparent: DrawItem[];
  styleBinFillOpaque: DrawItem[];
  styleBinEdgesOpaque: DrawItem[];
  styleBinFillTransparent: DrawItem[];
  styleBinEdgesTransparent: DrawItem[];
}
