/**
 * One node record in a parsed FBX document tree.
 *
 * FBX (binary or ASCII) is a tree of named nodes, each carrying a flat list of
 * scalar / string / typed-array properties and a list of child nodes. This is
 * the in-memory shape {@link readFBXBinary} produces and the parser walks.
 *
 * @internal
 */
export interface FBXNode {
  /** Node name, e.g. `"Objects"`, `"Geometry"`, `"Vertices"`. */
  name: string;
  /** Flat property list — numbers, booleans, strings, or typed arrays. */
  props: any[];
  /** Nested child nodes. */
  children: FBXNode[];
}

/** First child with the given name, or `undefined`. @internal */
export function findChild(node: FBXNode | undefined, name: string): FBXNode | undefined {
  if (!node) return undefined;
  for (const c of node.children) {
    if (c.name === name) return c;
  }
  return undefined;
}
