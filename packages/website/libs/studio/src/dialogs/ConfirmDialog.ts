/**
 * Lightweight modal confirm/cancel dialog. Promise-based: resolves
 * `true` when the user confirms, `false` when they cancel,
 * dismiss-via-backdrop, or press Escape.
 *
 * Visually matches the rest of the studio chrome (same fonts /
 * radii / shadow / palette as `LoaderProgressDialog`) but with no
 * progress bar, phase label, or `runWith` orchestration — just two
 * buttons.
 *
 * ```ts
 * import {confirmDialog} from "@xeokit/website-studio";
 *
 * const ok = await confirmDialog({
 *   title:   "Close View?",
 *   message: "The View will be hidden — a pill on the side rail lets you bring it back.",
 * });
 * if (ok) panel.hide();
 * ```
 *
 * @module studio/dialogs
 */

import {el} from "../utils/el";
import {showBackdrop, hideBackdrop} from "../panels/modalBackdrop";
import {bringFloatingPanelToFront} from "../panels/floatingPanelZ";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ConfirmDialogParams {

  /** Header text. Defaults to "Confirm". */
  title?: string;

  /**
   * Body message. Required. Plain text is rendered safely via
   * `textContent`; if the caller needs inline markup they can
   * supply a pre-built {@link HTMLElement} instead.
   */
  message: string | HTMLElement;

  /** Label for the confirm button. Defaults to "OK". */
  confirmLabel?: string;

  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;

  /**
   * Visual variant for the confirm button. `"danger"` paints it
   * red so destructive actions read as such; `"default"` uses the
   * studio accent blue. Defaults to `"default"`.
   */
  variant?: "default" | "danger";

  /**
   * DOM container the dialog mounts into. Defaults to
   * `document.body`. Same convention as
   * {@link LoaderProgressDialog}.
   */
  container?: HTMLElement;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-confirm-styles";
let _stylesInjected = false;

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = DIALOG_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}

const DIALOG_CSS = `
.xkt-confirm-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 380px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #111;
  z-index: 200000001;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
}
.xkt-confirm-dialog *, .xkt-confirm-dialog *::before, .xkt-confirm-dialog *::after {
  box-sizing: border-box;
}
.xkt-confirm-dialog .xkt-confirm-header {
  padding: 14px 18px 6px 18px;
  font-size: 13px;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: 0.2px;
}
.xkt-confirm-dialog .xkt-confirm-message {
  padding: 4px 18px 14px 18px;
  font-size: 13px;
  color: #333;
  white-space: pre-wrap;
}
.xkt-confirm-dialog .xkt-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #ececec;
  background: #fafbfc;
}
.xkt-confirm-dialog .xkt-confirm-btn {
  padding: 6px 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  border-radius: 5px;
  cursor: pointer;
  min-width: 84px;
  border: 1px solid transparent;
  background: transparent;
}
.xkt-confirm-dialog .xkt-confirm-cancel {
  color: #444;
  background: #fff;
  border-color: #c8d4e2;
}
.xkt-confirm-dialog .xkt-confirm-cancel:hover {
  background: #eef2f7;
  color: #222;
}
.xkt-confirm-dialog .xkt-confirm-ok {
  color: white;
  background: #2d5e8c;
  border-color: #2d5e8c;
}
.xkt-confirm-dialog .xkt-confirm-ok:hover {
  background: #224a70;
  border-color: #224a70;
}
.xkt-confirm-dialog .xkt-confirm-ok.xkt-confirm-danger {
  background: #b91c1c;
  border-color: #b91c1c;
}
.xkt-confirm-dialog .xkt-confirm-ok.xkt-confirm-danger:hover {
  background: #971515;
  border-color: #971515;
}
.xkt-confirm-dialog .xkt-confirm-btn:focus-visible {
  outline: 2px solid #2d5e8c;
  outline-offset: 2px;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Show a modal confirm dialog and resolve with the user's choice.
 *
 * Resolution rules:
 *  - confirm button click → `true`
 *  - cancel button click → `false`
 *  - Escape key → `false`
 *  - click on the backdrop → `false`
 *  - Enter key → `true` (the confirm button is auto-focused)
 *
 * The Promise never rejects.
 */
export function confirmDialog(params: ConfirmDialogParams): Promise<boolean> {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }
  injectStylesOnce();

  return new Promise<boolean>((resolve) => {
    const container = params.container || document.body;

    const dialog = el("div", "xkt-confirm-dialog", {
      role:           "alertdialog",
      "aria-modal":   "true",
      "aria-label":   params.title || "Confirm",
    });

    const header = el("div", "xkt-confirm-header", {
      textContent: params.title || "Confirm",
    });
    dialog.appendChild(header);

    const messageEl = el("div", "xkt-confirm-message");
    if (typeof params.message === "string") {
      messageEl.textContent = params.message;
    } else {
      messageEl.appendChild(params.message);
    }
    dialog.appendChild(messageEl);

    const actions = el("div", "xkt-confirm-actions");
    const cancelBtn = el("button", "xkt-confirm-btn xkt-confirm-cancel", {
      type:        "button",
      textContent: params.cancelLabel || "Cancel",
    }) as HTMLButtonElement;
    const confirmBtnClass = "xkt-confirm-btn xkt-confirm-ok"
      + (params.variant === "danger" ? " xkt-confirm-danger" : "");
    const confirmBtn = el("button", confirmBtnClass, {
      type:        "button",
      textContent: params.confirmLabel || "OK",
    }) as HTMLButtonElement;
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);

    container.appendChild(dialog);
    // Backdrop sits below the dialog. Click outside cancels — same
    // gesture as Escape, same semantics as the LoaderProgressDialog
    // backdrop behavior.
    const backdrop = showBackdrop(container, dialog, () => settle(false));
    // Tag the dialog as a top-of-stack modal so a freshly-popped
    // ViewPanel (or any other panel) doesn't render over the
    // dialog while the user is reading it.
    bringFloatingPanelToFront(dialog, true);

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
        settle(false);
      } else if (ev.key === "Enter") {
        ev.stopPropagation();
        ev.preventDefault();
        settle(true);
      }
    }
    document.addEventListener("keydown", onKey, true);

    let settled = false;
    function settle(result: boolean) {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, true);
      hideBackdrop(backdrop);
      if (dialog.parentElement) dialog.parentElement.removeChild(dialog);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => settle(false));
    confirmBtn.addEventListener("click", () => settle(true));

    // Defer focus so the click that opened the dialog doesn't
    // immediately re-fire Enter on the auto-focused confirm
    // button (rare, but real on quick double-clicks).
    setTimeout(() => confirmBtn.focus(), 0);
  });
}
