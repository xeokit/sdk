/**
 * Shared z-index counter for the floating demo panels
 * (`SceneHealthPanel`, `SceneStatsPanel`, `DataStatsPanel`,
 * `BoundariesPanel`, `TilesPanel`). Each panel calls
 * {@link bringFloatingPanelToFront} on `show()` and on every
 * pointer-down inside the panel — the helper bumps a
 * module-scope counter and writes the new value to the panel
 * element's inline `z-index`, so the most recently opened or
 * clicked panel always sits on top of its siblings without
 * panels needing to know about each other.
 *
 * The starting value matches the `z-index: 200000000` baseline
 * each panel's CSS uses, so the first `bringFloatingPanelToFront`
 * call already wins over any panel that was constructed but
 * hasn't been brought forward.
 *
 * @module demo/floatingPanelZ
 */

let _next = 200000000;

/**
 * Bring `panel` to the top of the floating-panel stack. Bumps
 * the shared counter and writes the new value as an inline
 * `z-index`. Cheap (one DOM write); safe to call on every
 * `pointerdown`.
 */
export function bringFloatingPanelToFront(panel: HTMLElement): void {
  panel.style.zIndex = String(++_next);
}
