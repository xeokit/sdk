/**
 * Backwards-compatible re-export for callers that still import
 * from `./ViewObjectContextMenu`. The implementation has moved
 * to a directory layout under `./contextMenus/` with one builder
 * per file (one class / interface / function per file for IDE
 * findability).
 *
 * @module demo/ViewObjectContextMenu
 */

export {
  ViewObjectContextMenu,
  CanvasContextMenu,
  type BaseViewContext,
  type ViewObjectContextMenuContext,
  type CanvasContextMenuContext,
} from "./contextMenus";
