/**
 * Builds the **Transform** submenu — Translate / Rotate / Scale
 * entries that attach the View's {@link viewing!transformControls.TransformControls | TransformControls}
 * to the right-clicked {@link viewing!viewer.ViewObject | ViewObject}
 * in the chosen mode.
 *
 * Mirrors the toolbar's transform-mode cluster: one entry per mode,
 * grouped under a "Transform" submenu so the top-level menu stays
 * uncluttered. Right-clicking an object and picking one of these
 * is the explicit "I want to transform this object" path; the
 * toolbar entries are the alternate "click a mode, then click an
 * object" path.
 *
 * @module studio/viewObjectContextMenu/submenus/createViewObjectTransformGroup
 */

import type {ViewObjectContextMenuContext} from "../ViewObjectContextMenuContext";
import {TransformControls} from "../../../viewing/transformControls";
import type {TransformControlsMode} from "../../../viewing/transformControls";


function attach(context: ViewObjectContextMenuContext, mode: TransformControlsMode): void {
  const view = context.view;
  if (!view) return;
  // Anchor the gizmo at the surface point the right-click landed
  // on, when the picker returned one — rotate / scale then operate
  // about exactly that point rather than the SceneObject's
  // geometric origin.
  const pivotWorld = context.pickedWorldPos ?? undefined;
  context.studio.attachTransformControls(
    view,
    context.viewObject.sceneObject,
    mode,
    pivotWorld ?? undefined,
  );
}

export function createViewObjectTransformGroup() {
  return {
    getTitle: () => "Transform",
    icon: TransformControls.iconSvg(),
    items: [
      [
        {
          getTitle: () => "Translate",
          doAction: (context: ViewObjectContextMenuContext) => attach(context, "translate"),
        },
        {
          getTitle: () => "Rotate",
          doAction: (context: ViewObjectContextMenuContext) => attach(context, "rotate"),
        },
        {
          getTitle: () => "Scale",
          doAction: (context: ViewObjectContextMenuContext) => attach(context, "scale"),
        },
      ],
      [
        {
          getTitle: () => "Detach",
          getEnabled: (context: ViewObjectContextMenuContext) => {
            const view = context.view;
            return !!view && !!TransformControls.getFor(view);
          },
          doAction: (context: ViewObjectContextMenuContext) => {
            const view = context.view;
            if (view) context.studio.detachTransformControls(view);
          },
        },
      ],
    ],
  };
}
