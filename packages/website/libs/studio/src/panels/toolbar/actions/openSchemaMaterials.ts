/**
 * Toolbar action — open the demo's {@link SchemaMaterialsPanel}.
 *
 * Surfaces the material-palette browser from the Present group
 * on the toolbar. Like Drawings, Schema Materials is an
 * authoring / output-side feature rather than a diagnostic,
 * which is why it lives under Present instead of Inspect.
 *
 */

import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";


export const openSchemaMaterials: ToolbarActionDescriptor = {
  id: "openSchemaMaterials",
  do(ctx) {
    if (ctx.fireAction("openSchemaMaterials")) return;
    if (!ctx.studio) {
      console.warn("[Toolbar] openSchemaMaterials — no Studio passed; nothing to drive Schema Materials panel from.");
      return;
    }
    ctx.studio.panels.open("schemaMaterials");
  }
};
