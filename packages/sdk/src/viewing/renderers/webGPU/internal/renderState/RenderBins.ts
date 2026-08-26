import type {DrawItem} from "./DrawItem";

export interface RenderBins {
  normalDrawOpaque: DrawItem[];
  normalEdgesOpaque: DrawItem[];
  normalFillTransparent: DrawItem[];
  xrayedFillOpaque: DrawItem[];
  xrayedEdgesOpaque: DrawItem[];
  xrayedFillTransparent: DrawItem[];
  xrayedEdgesTransparent: DrawItem[];
  highlightedFillOpaque: DrawItem[];
  highlightedEdgesOpaque: DrawItem[];
  highlightedFillTransparent: DrawItem[];
  highlightedEdgesTransparent: DrawItem[];
  selectedFillOpaque: DrawItem[];
  selectedEdgesOpaque: DrawItem[];
  selectedFillTransparent: DrawItem[];
  selectedEdgesTransparent: DrawItem[];
}
