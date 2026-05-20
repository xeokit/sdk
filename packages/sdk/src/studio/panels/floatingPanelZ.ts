/**
 * Two-tier z-index counter for the floating demo panels. Each
 * panel calls {@link bringFloatingPanelToFront} on `show()` and
 * on every pointer-down inside the panel — the helper bumps a
 * module-scope counter and writes the new value to the panel
 * element's inline `z-index`, so the most recently opened or
 * clicked panel always sits on top of its siblings without
 * panels needing to know about each other.
 *
 * ## Tiers
 *
 * The DOM has two independent stacks:
 *
 *  - **default** — the regular floating demo panels
 *    (`SceneHealthPanel`, `SceneStatsPanel`, `DataStatsPanel`,
 *    `BoundariesPanel`, `TilesPanel`, dialogs, etc.). Counter
 *    starts at `200100000`.
 *  - **view** — `ViewPanel` instances hosting hosted Views.
 *    Counter starts at `100100000`, so every view panel sits
 *    strictly below every default-tier panel. View panels
 *    still reorder among themselves on click.
 *
 * The tier is read from the panel element's `data-xkt-tier`
 * attribute, set once by `FloatingPanelBase` from its
 * `FloatingPanelBaseParams.tier` constructor param. Panels
 * that don't set it default to the `default` tier.
 *
 * The starting values are one above each tier's CSS baseline so
 * the first `bringFloatingPanelToFront` call already wins over
 * any sibling panel that was constructed but hasn't been
 * brought forward yet.
 *
 * @module demo/floatingPanelZ
 */

import {lowestModalBackdropZ} from "./modalBackdrop";


const VIEW_TIER_START    = 100100000;
const DEFAULT_TIER_START = 200100000;

let _nextView    = VIEW_TIER_START;
let _nextDefault = DEFAULT_TIER_START;

/**
 * Bring `panel` to the top of its tier's floating-panel stack.
 * Bumps that tier's counter and writes the new value as an
 * inline `z-index`. Cheap (one DOM write); safe to call on
 * every `pointerdown`.
 *
 * **View-tier panels** (those carrying `data-xkt-tier="view"`)
 * always stay strictly below default-tier panels — the helper
 * never crosses tiers, even when a modal is up, because view
 * panels are below the default-tier scrim by tier already.
 *
 * **Default-tier panels** get the existing modal-clamp: when
 * any modal is open and `aboveModals` is `false` (the default),
 * the panel is pinned just below the lowest active modal
 * backdrop instead of being bumped over the top, so a non-modal
 * panel that auto-pops while a dialog is up renders dimmed
 * behind the scrim. Modal panels themselves pass
 * `aboveModals: true` so they pop to the front as expected.
 */
export function bringFloatingPanelToFront(panel: HTMLElement, aboveModals: boolean = false): void {
  if (panel.getAttribute("data-xkt-tier") === "view") {
    panel.style.zIndex = String(++_nextView);
    return;
  }
  const lowestBackdrop = lowestModalBackdropZ();
  if (!aboveModals && lowestBackdrop !== null) {
    panel.style.zIndex = String(lowestBackdrop - 1);
    return;
  }
  panel.style.zIndex = String(++_nextDefault);
}
