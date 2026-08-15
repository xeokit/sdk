import type {Vec3} from "../../../../base/math/vector";
import type {SceneMesh} from "../../../../model/scene";
import type {View, ViewObject} from "../../../viewer";

export interface MeshDrawStyle {
  color: Vec3 | number[];
  opacity: number;
  alphaMode: number;
  emphasis: "normal" | "xrayed" | "highlighted" | "selected";
  drawEdges: boolean;
}

const DEFAULT_COLOR = [1, 1, 1];

export function resolveMeshDrawStyle(mesh: SceneMesh, view: View, viewObject: ViewObject | null): MeshDrawStyle {
  if (viewObject?.selected) {
    return resolveEffectStyle(view.selectedMaterial, "selected");
  }
  if (viewObject?.highlighted) {
    return resolveEffectStyle(view.highlightMaterial, "highlighted");
  }
  if (viewObject?.xrayed) {
    return resolveEffectStyle(view.xrayMaterial, "xrayed");
  }

  const opacity = viewObject?.opacityUpdated
    ? viewObject.opacity
    : mesh.effectiveOpacity ?? mesh.opacity ?? 1;
  return {
    color: viewObject?.colorize ?? mesh.effectiveColor ?? mesh.color ?? DEFAULT_COLOR,
    opacity: clamp01(opacity),
    alphaMode: Number.isFinite(mesh.effectiveAlphaMode) ? mesh.effectiveAlphaMode : 0,
    emphasis: "normal",
    drawEdges: !!view.effects?.edges?.applied
  };
}

function resolveEffectStyle(effect: any, emphasis: MeshDrawStyle["emphasis"]): MeshDrawStyle {
  return {
    color: effect?.fillColor ?? DEFAULT_COLOR,
    opacity: clamp01(effect?.fill === false ? 0 : effect?.fillAlpha ?? 1),
    alphaMode: 0,
    emphasis,
    drawEdges: effect?.edges !== false
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
