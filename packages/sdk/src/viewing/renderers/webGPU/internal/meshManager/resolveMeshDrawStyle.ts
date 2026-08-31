import type {Vec3} from "../../../../../base/math/vector";
import type {SceneMesh} from "../../../../../model/scene";
import type {View, ViewObject, ViewStyleBin} from "../../../../viewer";

export interface MeshDrawStyle {
  color: Vec3 | number[];
  opacity: number;
  alphaMode: number;
  styleBinId: string | null;
  drawEdges: boolean;
}

const DEFAULT_COLOR = [1, 1, 1];

export function resolveMeshDrawStyle(mesh: SceneMesh, view: View, viewObject: ViewObject | null): MeshDrawStyle {
  const styleBin = resolveStyleBin(view, viewObject);
  return styleBin ? resolveStyleBinStyle(styleBin) : resolveBaseMeshDrawStyle(mesh, view, viewObject);
}

function resolveBaseMeshDrawStyle(mesh: SceneMesh, view: View, viewObject: ViewObject | null): MeshDrawStyle {
  const opacity = viewObject?.opacityUpdated
    ? viewObject.opacity
    : mesh.effectiveOpacity ?? mesh.opacity ?? 1;
  return {
    color: viewObject?.colorize ?? mesh.effectiveColor ?? mesh.color ?? DEFAULT_COLOR,
    opacity: clamp01(opacity),
    alphaMode: Number.isFinite(mesh.effectiveAlphaMode) ? mesh.effectiveAlphaMode : 0,
    styleBinId: null,
    drawEdges: !!view.effects?.edges?.applied
  };
}

function resolveStyleBin(view: View, viewObject: ViewObject | null): ViewStyleBin | null {
  if (!viewObject) {
    return null;
  }
  const styleBins = view.styleBins.list;
  let resolvedBin: ViewStyleBin | null = null;
  for (let i = 0, len = styleBins.length; i < len; i++) {
    const styleBin = styleBins[i];
    if (!styleBin.enabled) {
      continue;
    }
    if (viewObject.hasStyleBin(styleBin.id)) {
      resolvedBin = styleBin;
    }
  }
  return resolvedBin;
}

function resolveStyleBinStyle(styleBin: ViewStyleBin): MeshDrawStyle {
  const effect = styleBin.material;
  return {
    color: effect?.fillColor ?? DEFAULT_COLOR,
    opacity: clamp01(effect?.fill === false ? 0 : effect?.fillAlpha ?? 1),
    alphaMode: 0,
    styleBinId: styleBin.id,
    drawEdges: effect?.edges !== false
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
