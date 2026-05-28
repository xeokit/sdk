/**
 * Render-mode preset group — drives `view.renderMode` to one of
 * the three preset constants. The currently-active mode is
 * disabled (matches the camera-projection group's idiom).
 *
 * @module studio/viewObjectContextMenu/submenus/createRenderModeGroup
 */

import {DetailedRender, NavigationRender, RealisticRender} from "../../../base/constants";
import type {BaseViewContext} from "../BaseViewContext";


export function createRenderModeGroup() {
  return [
    {
      getTitle: () => "Navigation Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== NavigationRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = NavigationRender;
      }
    },
    {
      getTitle: () => "Detailed Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== DetailedRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = DetailedRender;
      }
    },
    {
      getTitle: () => "Realistic Render",
      getEnabled: (context: BaseViewContext) => {
        return context.view.renderMode !== RealisticRender;
      },
      doAction: (context: BaseViewContext) => {
        context.view.renderMode = RealisticRender;
      }
    }
  ];
}
