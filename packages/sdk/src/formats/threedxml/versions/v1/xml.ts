/**
 * Small namespace-tolerant XML helpers over the browser `DOMParser`, shared by
 * the 3DXML manifest / product-structure / representation parsers.
 *
 * 3DXML documents use default + prefixed namespaces inconsistently across
 * versions, so every lookup matches by *local* name (ignoring any prefix) via
 * `getElementsByTagNameNS('*', name)` / a `localName` filter.
 *
 * @internal
 */

/** Parses an XML string into a Document, throwing on a malformed document. */
export function parseXML(text: string): Document {
  if (typeof DOMParser === "undefined") {
    throw new Error("[3DXMLLoader] DOMParser is not available — run in a browser, or install a DOMParser polyfill (e.g. linkedom / @xmldom/xmldom) onto globalThis");
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  // DOMParser reports malformed XML as a <parsererror> element rather than throwing.
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) {
    throw new Error(`[3DXMLLoader] malformed XML: ${(err.textContent || "").trim().slice(0, 200)}`);
  }
  return doc;
}

/** All descendant elements with the given local name (any namespace). */
export function descendants(root: Element | Document, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", localName));
}

/** The first descendant element with the given local name, or null. */
export function firstDescendant(root: Element | Document, localName: string): Element | null {
  return root.getElementsByTagNameNS("*", localName)[0] ?? null;
}

/** Direct child elements with the given local name (any namespace). */
export function childrenByLocalName(el: Element, localName: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === localName) {
      out.push(n);
    }
  }
  return out;
}

/** Trimmed text content of the first descendant with the given local name, or null. */
export function textOf(root: Element | Document, localName: string): string | null {
  const el = firstDescendant(root, localName);
  const t = el?.textContent;
  return t == null ? null : t.trim();
}

/** Extracts every signed/decimal/exponent number from a string (whitespace/comma/`;` agnostic). */
export function numbersIn(text: string | null | undefined): number[] {
  if (!text) {
    return [];
  }
  const matches = text.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!matches) {
    return [];
  }
  const out = new Array<number>(matches.length);
  for (let i = 0; i < matches.length; i++) {
    out[i] = parseFloat(matches[i]);
  }
  return out;
}
