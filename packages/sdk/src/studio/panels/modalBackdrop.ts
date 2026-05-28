/**
 * Shared modal-backdrop helper. Used by `FloatingPanelBase`
 * and `LoaderProgressDialog` — anything that wants a centered
 * modal dialog with a dim scrim, click-outside dismiss, and
 * correct stacking against other open panels.
 *
 * The backdrop's z-index is pinned **one below** the panel's
 * current `style.zIndex` so a fresh modal automatically sits
 * above any previously-opened modal, with its own scrim above
 * the older modal's panel.
 *
 */

const MODAL_BACKDROP_CLASS = "xkt-modal-backdrop";
const STYLE_ID = "xkt-modal-styles";
let _stylesInjected = false;

/**
 * Active backdrops, in show order. Used by `bringFloatingPanelToFront`
 * to clamp non-modal panels below the lowest active modal — so a
 * panel that auto-pops while a dialog is open (e.g. the Events
 * panel after an error) renders dimmed behind the scrim instead
 * of breaking through the modal.
 */
const _activeBackdrops = new Set<HTMLElement>();

/** Lowest z-index among active modal backdrops, or `null` when none are up. */
export function lowestModalBackdropZ(): number | null {
  let min: number | null = null;
  for (const b of _activeBackdrops) {
    const z = parseInt(b.style.zIndex || "", 10);
    if (Number.isFinite(z)) min = min === null ? z : Math.min(min, z);
  }
  return min;
}

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.${MODAL_BACKDROP_CLASS} {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}
`;
  document.head.appendChild(style);
  _stylesInjected = true;
}

/** Show a backdrop in `container`, paired to `panel`. */
export function showBackdrop(
  container: HTMLElement,
  panel: HTMLElement,
  onClickOutside?: () => void,
): HTMLElement {
  injectStylesOnce();
  const backdrop = document.createElement("div");
  backdrop.className = MODAL_BACKDROP_CLASS;
  if (onClickOutside) {
    backdrop.addEventListener("pointerdown", (ev) => {
      if (ev.target === backdrop) onClickOutside();
    });
  }
  container.insertBefore(backdrop, panel);
  syncBackdropZ(backdrop, panel);
  _activeBackdrops.add(backdrop);
  return backdrop;
}

/** Remove a backdrop produced by {@link showBackdrop}. */
export function hideBackdrop(backdrop: HTMLElement | null): void {
  if (!backdrop) return;
  _activeBackdrops.delete(backdrop);
  backdrop.remove();
}

/**
 * Pin `backdrop`'s z-index to `panel.style.zIndex - 1` so the
 * scrim always sits just under its panel — and just over the
 * next-deepest modal in the stack.
 */
export function syncBackdropZ(backdrop: HTMLElement, panel: HTMLElement): void {
  const z = parseInt(panel.style.zIndex || "", 10);
  if (Number.isFinite(z)) backdrop.style.zIndex = String(z - 1);
}
