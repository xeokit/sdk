/**
 * Debug submenu — gated on {@link StudioConfig.debug}.
 * Hosts engineer-only entries (currently just the WebGL
 * context-loss simulator). Returns `null` when the debug flag
 * is unset, so the caller filters it out of the menu.
 *
 * @module studio/viewObjectContextMenu/submenus/createDebugSubmenu
 */

import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import type {Renderer} from "@xeokit/sdk/viewing/rendering";
import type {BaseViewContext} from "../BaseViewContext";


export function createDebugSubmenu(debug: boolean) {
  if (!debug) return null;
  return {
    getTitle: () => "Debug",
    items: [
      [
        {
          getTitle: () => "Lose WebGL Context",
          doAction: (context: BaseViewContext) => {
            loseWebGLContext(context.renderer);
          },
        },
      ],
    ],
  };
}

/**
 * Forces the renderer's WebGL context to be lost.
 */
function loseWebGLContext(renderer: Renderer): void {
  if (!(renderer instanceof WebGLRenderer)) {
    console.warn("[Studio] Lose WebGL Context requires WebGLRenderer.");
    return;
  }
  renderer.loseContext();
}
