/**
 * Toolbar action — toggle camera projection between perspective
 * and ortho. Orientation is left untouched (the 2D/3D action
 * handles that case).
 *
 * @module demo/toolbar/actions/toggleProjection
 */

import {OrthoProjectionType, PerspectiveProjectionType} from "../../../../base/constants";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const toggleProjection: ToolbarActionDescriptor = {
  id: "toggleProjection",
  do(ctx) {
    if (ctx.fireAction("toggleProjection")) return;
    const view = ctx.activeView();
    const camera: any = view && (view as any).camera;
    if (!camera) {
      console.warn("[Toolbar] toggleProjection — no Camera on the active View.");
      return;
    }
    const wasOrtho = camera.projectionType === OrthoProjectionType;
    camera.projectionType = wasOrtho ? PerspectiveProjectionType : OrthoProjectionType;
    ctx.setPressed("toggleProjection", !wasOrtho);
    if (wasOrtho) ctx.setPressed("toggle2D3D", false);
  }
};
