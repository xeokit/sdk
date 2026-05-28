/**
 * Shared horizontal rail at the bottom-right of each
 * floating-panel container, hosting every panel's reopen pill
 * in a flex row so they don't overlap each other.
 *
 * Each panel still owns its own pill DOM and styling; this
 * module just re-parents the pill into the rail and overrides
 * its positioning to flow inline with its siblings.
 *
 */

const RAIL_CLASS  = "xkt-pill-rail";
const STYLE_ID    = "xkt-pill-rail-styles";

// Rail z-index — well above the floating-panel counter (anchored
// at 200000000 and walking upward via bringFloatingPanelToFront)
// so tall panels like the Views / Models browsers can't visually
// cover the pills. Picked moderate enough (1 billion) to dodge any
// browser-specific quirk at near-int32-max z values.
const RAIL_CSS = `
.${RAIL_CLASS} {
  position: fixed;
  bottom: 17px;
  right: 17px;
  z-index: 1000000000;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.${RAIL_CLASS} > * {
  position: static !important;
  bottom: auto !important;
  right: auto !important;
  left: auto !important;
  top: auto !important;
  /* The toolbar's own pill carries a translateX(-50%) for its
   * top-centred default position. Inside the rail it would shift
   * the pill half its width off to the left, hiding it behind the
   * viewport edge. Neutralise any inherited transform here. */
  transform: none !important;
  pointer-events: auto;
}
`;

const railByContainer = new WeakMap<HTMLElement, HTMLElement>();

function injectStylesOnce(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = RAIL_CSS;
  document.head.appendChild(style);
}

function getOrCreateRail(container: HTMLElement): HTMLElement {
  const cached = railByContainer.get(container);
  if (cached && cached.isConnected) return cached;
  injectStylesOnce();
  const rail = document.createElement("div");
  rail.className = RAIL_CLASS;
  container.appendChild(rail);
  railByContainer.set(container, rail);
  return rail;
}

/**
 * Move `pill` into the shared rail under `container`, creating
 * the rail on first call. Safe to call repeatedly — the pill is
 * just re-appended.
 */
export function registerPill(pill: HTMLElement, container: HTMLElement): void {
  const rail = getOrCreateRail(container);
  rail.appendChild(pill);
}

/**
 * Remove `pill` from whichever rail it's in. Called on panel
 * destroy. No-op when the pill isn't in a rail.
 */
export function unregisterPill(pill: HTMLElement): void {
  const parent = pill.parentElement;
  if (parent && parent.classList.contains(RAIL_CLASS)) {
    parent.removeChild(pill);
  }
}
