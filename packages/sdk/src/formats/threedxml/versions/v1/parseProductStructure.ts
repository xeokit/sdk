/**
 * Parses a 3DXML product-structure (model) document into an assembly graph.
 *
 * The structure lives under `<ProductStructure>` as a flat list of nodes wired
 * by id references:
 *   - `Reference3D`  — a part/product (a node that can be instanced)
 *   - `ReferenceRep` — names the file holding a part's tessellation
 *   - `Instance3D`   — places one Reference3D under another, with a RelativeMatrix
 *   - `InstanceRep`  — attaches a ReferenceRep to a Reference3D
 * `Instance*` nodes carry `<IsAggregatedBy>` (parent) and `<IsInstanceOf>` (child)
 * id references. The traversal in parse.ts walks this graph from the root.
 *
 * @internal
 */
import {childrenByLocalName, descendants, numbersIn, textOf} from "./xml";
import type {Instance3D, InstanceRep, ProductStructure, Reference3D, ReferenceRep} from "./types";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function parseProductStructure(doc: Document): ProductStructure {
  const references = new Map<string, Reference3D>();
  const referenceReps = new Map<string, ReferenceRep>();
  const instance3Ds: Instance3D[] = [];
  const instanceReps: InstanceRep[] = [];

  for (const el of descendants(doc, "Reference3D")) {
    const id = el.getAttribute("id");
    if (id) {
      references.set(id, {id, name: el.getAttribute("name") || undefined});
    }
  }

  for (const el of descendants(doc, "ReferenceRep")) {
    const id = el.getAttribute("id");
    if (id) {
      referenceReps.set(id, {
        id,
        name: el.getAttribute("name") || undefined,
        associatedFile: el.getAttribute("associatedFile") || undefined,
      });
    }
  }

  for (const el of descendants(doc, "Instance3D")) {
    const id = el.getAttribute("id");
    const aggregatedBy = idRef(el, "IsAggregatedBy");
    const instanceOf = idRef(el, "IsInstanceOf");
    if (!id || !aggregatedBy || !instanceOf) {
      continue;
    }
    instance3Ds.push({
      id,
      name: el.getAttribute("name") || undefined,
      aggregatedBy,
      instanceOf,
      matrix: relativeMatrix(el),
    });
  }

  for (const el of descendants(doc, "InstanceRep")) {
    const id = el.getAttribute("id");
    const aggregatedBy = idRef(el, "IsAggregatedBy");
    const instanceOf = idRef(el, "IsInstanceOf");
    if (!id || !aggregatedBy || !instanceOf) {
      continue;
    }
    instanceReps.push({id, name: el.getAttribute("name") || undefined, aggregatedBy, instanceOf});
  }

  return {rootRef: findRoot(doc, references, instance3Ds), references, referenceReps, instance3Ds, instanceReps};
}

/**
 * `<IsAggregatedBy>` / `<IsInstanceOf>` carry the target id as text. Tolerates a
 * trailing `#…` fragment or `urn:…:<id>` form some exporters emit.
 */
function idRef(instance: Element, tag: string): string | null {
  const raw = textOf(instance, tag);
  if (!raw) {
    return null;
  }
  const hash = raw.lastIndexOf("#");
  const colon = raw.lastIndexOf(":");
  const cut = Math.max(hash, colon);
  return cut >= 0 ? raw.slice(cut + 1).trim() : raw;
}

/**
 * `<RelativeMatrix>` is 12 numbers — three 3-vectors (the local X/Y/Z axes)
 * followed by the translation — i.e. the upper 3×4 of a column-major transform.
 * Expanded here to a 4×4 column-major matrix. Missing/short ⇒ identity.
 */
function relativeMatrix(instance: Element): number[] {
  const m = childrenByLocalName(instance, "RelativeMatrix")[0];
  const v = numbersIn(m?.textContent);
  if (v.length < 12) {
    return IDENTITY.slice();
  }
  return [
    v[0], v[1], v[2], 0,
    v[3], v[4], v[5], 0,
    v[6], v[7], v[8], 0,
    v[9], v[10], v[11], 1,
  ];
}

/**
 * The root is the `<ProductStructure root="…">` attribute when present;
 * otherwise the one Reference3D that no Instance3D instantiates.
 */
function findRoot(doc: Document, references: Map<string, Reference3D>, instance3Ds: Instance3D[]): string {
  const ps = descendants(doc, "ProductStructure")[0];
  const declared = ps?.getAttribute("root");
  if (declared && references.has(declared)) {
    return declared;
  }
  const instanced = new Set(instance3Ds.map(i => i.instanceOf));
  for (const id of references.keys()) {
    if (!instanced.has(id)) {
      return id;
    }
  }
  return references.keys().next().value ?? "";
}
