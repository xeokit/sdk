/**
 * Tiny DOM-element factory shared by every floating demo panel.
 *
 * Reads as `el("button", "xkt-foo-close", {type: "button", ...})`
 * — terser than `document.createElement` + a chain of property
 * assignments, and resolves the right HTMLElement subtype via
 * the overload signature so callers don't need to cast.
 *
 * Property routing:
 *
 *  - `textContent` / `innerHTML` are assigned directly.
 *  - `hidden` is coerced to a boolean (so `hidden: false` actually
 *    *removes* the attribute rather than treating any string value
 *    as truthy).
 *  - Any other key that already exists as a property on the element
 *    is set as a property (covers `type`, `value`, `disabled`,
 *    `checked`, etc.).
 *  - Everything else falls through to `setAttribute(k, String(v))`
 *    — for `aria-*`, `data-*`, `role`, etc.
 *
 * @module demo/utils/el
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  props?: Record<string, unknown>,
): HTMLElementTagNameMap[K];
export function el(tag: string, className?: string, props?: Record<string, unknown>): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === undefined) continue;
      if (k === "textContent" || k === "innerHTML") {
        (node as any)[k] = v;
      } else if (k === "hidden") {
        (node as HTMLElement).hidden = !!v;
      } else if (k in node) {
        (node as any)[k] = v;
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  return node;
}
