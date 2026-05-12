/**
 * Debug submenu — gated on {@link DemoHelperConfig.debug}.
 * Hosts engineer-only entries (currently just the WebGL
 * context-loss simulator). Returns `null` when the debug flag
 * is unset, so the caller filters it out of the menu.
 *
 * @module demo/viewObjectContextMenu/submenus/createDebugSubmenu
 */

import type {WebGLRenderer} from "../../../webGLRenderer";
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
function loseWebGLContext(renderer: WebGLRenderer): void {
  // TODO
}
