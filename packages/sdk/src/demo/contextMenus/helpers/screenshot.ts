/**
 * Snapshot-capture support for the **Export** submenu's "Save
 * Screenshot" entry — icon SVG, file-name derivation, and the
 * async capture+download path itself.
 *
 * @module demo/viewObjectContextMenu/helpers/screenshot
 */

import type {BaseViewContext} from "../BaseViewContext";
import {downloadDataUrl, sanitizeFileName} from "./download";


/**
 * SVG markup for the Save-Screenshot menu glyph — a camera body
 * with a centred lens. Strokes use `currentColor`, so the
 * context menu's accent shows through.
 */
export function screenshotIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    // Body shell.
    `<path d="M 4 8 H 8 L 9.5 6 H 14.5 L 16 8 H 20 A 1.5 1.5 0 0 1 21.5 9.5 V 17.5 A 1.5 1.5 0 0 1 20 19 H 4 A 1.5 1.5 0 0 1 2.5 17.5 V 9.5 A 1.5 1.5 0 0 1 4 8 Z" ` +
          `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    // Lens.
    `<circle cx="12" cy="13.5" r="3.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    // Lens highlight (small dot).
    `<circle cx="18.4" cy="10.4" r="0.6" fill="currentColor"/>` +
  `</svg>`;
}

/**
 * Builds a file name for a saved screenshot — `<sceneModel>-<viewId>-screenshot.png`,
 * with the view id omitted when the view has none.
 */
export function getScreenshotFileName(context: BaseViewContext): string {
  const viewId = (context.view as any)?.id;
  const baseName = viewId
    ? `${context.sceneModel.id}-${String(viewId)}`
    : context.sceneModel.id;
  return `${sanitizeFileName(baseName)}-screenshot.png`;
}

/**
 * Captures the active View's current frame as a PNG and downloads
 * it. Bridges `WebGLRenderer.getSnapshot` with the helper-side
 * `<a download>` flow.
 */
export async function saveViewScreenshot(context: BaseViewContext): Promise<void> {
  const fileName = getScreenshotFileName(context);
  const result = context.renderer.getSnapshot(context.view);
  if (result.ok === false) {
    console.error("Failed to capture screenshot:", result.error);
    return;
  }
  downloadDataUrl(result.value, fileName);
}
