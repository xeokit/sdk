/**
 * Lazily-initialised, module-scoped MaterialsPalette shared by
 * every {@link ViewObjectContextMenu} / {@link CanvasContextMenu}
 * instance. Built on first menu invocation; subsequent invocations
 * re-use it so the per-(SceneModel, painter) material cache
 * survives across right-clicks.
 *
 * @module studio/viewObjectContextMenu/helpers/getMaterialsPalette
 */

import {MaterialsPalette} from "@xeokit/website-presentations/materials";


let _materialsPalette: MaterialsPalette | undefined;

export function getMaterialsPalette(): MaterialsPalette {
  if (!_materialsPalette) {
    _materialsPalette = new MaterialsPalette();
  }
  return _materialsPalette;
}
