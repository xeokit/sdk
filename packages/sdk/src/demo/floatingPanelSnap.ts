/**
 * Edge-snap helper shared by every floating demo panel
 * (`SceneHealthPanel`, `DataHealthPanel`, `SceneStatsPanel`,
 * `DataStatsPanel`, `BoundariesPanel`, `TilesPanel`,
 * `EventsPanel`, `ExplorerPanel`, `GPUMemoryPanel`,
 * `ViewerConfigPanel`, `SchemaMaterialsPanel`,
 * `SampleModelsPanel`, `ExportDialog`, `Toolbar`).
 *
 * Each panel's drag handler converts the pointer position into a
 * desired top-left corner and asks this helper to clamp + snap
 * before writing the result back to inline `left` / `top`. The
 * snap pulls the panel onto the matching viewport edge whenever
 * the desired position lands within `threshold` pixels — without
 * the snap a panel "almost" docked to an edge leaves a one-pixel
 * gutter that reads as misalignment when several panels are
 * docked side by side.
 *
 * @module demo/floatingPanelSnap
 */

/**
 * Distance in pixels within which a panel edge gets pulled flush
 * to a snap target. Twelve pixels matches the value Apple Finder
 * / VS Code use for window-snap heuristics — close enough that
 * intentional alignments engage, far enough that grazing past an
 * edge mid-drag doesn't capture the panel.
 */
export const PANEL_SNAP_THRESHOLD = 12;

/**
 * Common gutter the panels' default CSS uses for their initial
 * `top`, `left`, `right` and `bottom` offsets. The snap helper
 * also docks to this value (alongside `0` and `maxL` / `maxT`)
 * so a user dragging a panel back toward its starting position
 * lands cleanly on the same gutter the rest of the panels use.
 */
export const PANEL_GUTTER = 17;

/**
 * Registry of every floating panel currently mounted in the
 * page. Each panel calls {@link registerFloatingPanel} from its
 * constructor and {@link unregisterFloatingPanel} from
 * `destroy()`. {@link snapToEdges} reads the registry on every
 * pointermove tick to add inter-panel snap targets — so dragging
 * one panel near another's edge pulls the two flush.
 */
const _panels = new Set<HTMLElement>();

/** Add `panel` to the inter-panel snap registry. Idempotent. */
export function registerFloatingPanel(panel: HTMLElement): void {
  _panels.add(panel);
}

/** Remove `panel` from the inter-panel snap registry. Idempotent. */
export function unregisterFloatingPanel(panel: HTMLElement): void {
  _panels.delete(panel);
}

/**
 * Clamp a panel's top-left to the visible viewport, snapping to
 *
 *   - the four viewport edges (`0` / `maxLeft` / `maxTop`),
 *   - the conventional {@link PANEL_GUTTER} offsets,
 *   - and every edge of every *other* registered floating panel
 *     (so a drag near another panel pulls the two flush —
 *     left↔left, left↔right, right↔left, right↔right, plus the
 *     equivalent vertical pairings).
 *
 * Whenever the desired coordinate lands within `threshold`
 * pixels of any target. Returns a fresh object — the caller
 * writes `result.left` / `result.top` back to the inline style.
 *
 * @param left          Desired left in CSS pixels (pre-clamp).
 * @param top           Desired top  in CSS pixels (pre-clamp).
 * @param panelWidth    Panel's current rendered width.
 * @param panelHeight   Panel's current rendered height.
 * @param exclude       Element to exclude from the inter-panel
 *                      target list — typically the dragged panel
 *                      itself, so it doesn't snap to its own
 *                      edges.
 * @param threshold     Snap distance in pixels. Defaults to
 *                      {@link PANEL_SNAP_THRESHOLD}.
 */
export function snapToEdges(
  left: number,
  top: number,
  panelWidth: number,
  panelHeight: number,
  exclude?: HTMLElement | null,
  threshold: number = PANEL_SNAP_THRESHOLD,
): {left: number; top: number} {
  const maxL = Math.max(0, window.innerWidth  - panelWidth);
  const maxT = Math.max(0, window.innerHeight - panelHeight);

  // Viewport + gutter targets.
  const horizTargets: number[] = [0, PANEL_GUTTER, maxL - PANEL_GUTTER, maxL];
  const vertTargets:  number[] = [0, PANEL_GUTTER, maxT - PANEL_GUTTER, maxT];

  // Inter-panel targets. For each other live panel the dragged
  // panel can snap so its left edge meets the other panel's
  // left or right (push horizTargets directly), or so its right
  // edge meets the other panel's left or right (push the other's
  // left/right minus the dragged panel's width, since the
  // dragged panel's right edge = left + panelWidth). Same logic
  // vertically.
  for (const el of _panels) {
    if (el === exclude) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    horizTargets.push(rect.left,  rect.right);
    horizTargets.push(rect.left  - panelWidth, rect.right - panelWidth);
    vertTargets.push(rect.top, rect.bottom);
    vertTargets.push(rect.top  - panelHeight, rect.bottom - panelHeight);
  }

  left = nearestSnap(left, horizTargets, threshold);
  top  = nearestSnap(top,  vertTargets,  threshold);

  // Final clamp — guards the (rare) case where the viewport is
  // smaller than the panel itself, so no snap target fired.
  left = Math.max(0, Math.min(left, maxL));
  top  = Math.max(0, Math.min(top,  maxT));

  return {left, top};
}

/**
 * Return whichever of `targets` lies within `threshold` of
 * `value`, picking the closest. Falls back to `value` when no
 * target qualifies. Targets <= 0 (off-screen) are skipped only
 * if they're not exactly 0 — a panel docked at the viewport's
 * left/top edge is a legitimate target.
 */
function nearestSnap(value: number, targets: number[], threshold: number): number {
  let bestDelta = threshold;
  let best = value;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(value - t);
    if (d <= bestDelta) {
      bestDelta = d;
      best = t;
    }
  }
  return best;
}
