/**
 * Toolbar action — force a WebGL context loss and automatic restore, for
 * testing the renderer's context-restore path.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";
import {asWebGLRenderer} from "../../resolveWebGLRenderer";


export const loseContext: ToolbarActionDescriptor = {
  id: "loseContext",
  do(ctx) {
    if (ctx.fireAction("loseContext")) return;
    const renderer = ctx.studio?.renderer;
    if (!renderer) {
      console.warn("[Toolbar] loseContext — no Studio renderer available.");
      return;
    }
    const webGLRenderer = asWebGLRenderer(renderer);
    if (!webGLRenderer) {
      console.warn("[Toolbar] loseContext requires WebGLRenderer.");
      return;
    }
    webGLRenderer.loseContext();
  }
};
