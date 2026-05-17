/**
 * Parse a STEP DATA section into an EXPRESS instance graph.
 *
 * Input is the raw text of a STEP file (HEADER + DATA). We slice
 * out the DATA section ourselves, run it through the {@link Lexer},
 * and walk the token stream into a `Map<ref, Entity>` plus a
 * per-type bucket index for cheap "find every PRODUCT" style
 * queries.
 *
 * Recovery rules — one bad statement shouldn't take down the rest
 * of the file:
 *
 *   - Any token mismatch in the head of a statement (`#N = TYPE (`)
 *     drops the partial state and resyncs at the next `;`.
 *   - Inside an arg list, a malformed value bails out and we resync
 *     at the next `,` or `)`.
 *   - The lexer never throws — even unterminated strings come out
 *     as a `STR` token with whatever bytes we collected.
 *
 * Performance: the graph for a 50MB STEP file builds in roughly
 * the time it takes to read the file from disk; the hot path is
 * `Lexer.next` and the `byType` push.
 *
 * @internal
 */

import {Lexer, type Token, type TokenKind} from "./tokenize";

/** Discriminated value tree for an entity argument. */
export type Value =
  | {kind: "ref";     ref: number}
  | {kind: "str";     value: string}
  | {kind: "num";     value: number}
  | {kind: "enum";    name: string}
  | {kind: "list";    items: Value[]}
  | {kind: "typed";   type: string; args: Value[]}
  | {kind: "null"}
  | {kind: "derived"};

/** One `#N = TYPE(args);` statement. */
export interface Entity {
  ref:  number;
  type: string;
  args: Value[];
}

export interface InstanceGraph {
  /** `#N → Entity`. */
  byRef:  Map<number, Entity>;
  /** Entities grouped by type name — `byType.get("PRODUCT")` etc. */
  byType: Map<string, Entity[]>;
  /**
   * Inverse ref index. `referrers.get(target)` is every entity
   * whose argument list mentions `#target` — directly or as part
   * of a list / typed parameter. Built once after parsing so
   * walkers don't have to scan a type bucket on every hop.
   *
   * Walkers that need a typed answer (e.g. "find the
   * `PRODUCT_DEFINITION_FORMATION` whose arg 2 references X")
   * filter the bucket in O(referrers-of-X) instead of
   * O(all-entities-of-type).
   */
  referrers: Map<number, Entity[]>;
}

/**
 * Build an instance graph from the DATA section of a STEP file.
 * `text` must contain the whole file; `dataStart`/`dataEnd` window
 * onto the section between `DATA;` and the matching `ENDSEC;`.
 * Pass `0` / `text.length` to lex the whole file (anything outside
 * the DATA section is then just noise the recovery path skips).
 */
export function parseInstanceGraph(
  text: string,
  dataStart: number,
  dataEnd: number,
): InstanceGraph {

  const slice = text.slice(dataStart, dataEnd);
  const lexer = new Lexer(slice);

  const byRef  = new Map<number, Entity>();
  const byType = new Map<string, Entity[]>();

  // Single-token lookahead. `cur` is always the next unconsumed
  // token; statement parsers consume + advance internally.
  // `peek()` returns `cur.kind` through a function call so TS
  // doesn't narrow the type past closure mutations from
  // `advance()` / `expect()`.
  let cur: Token = lexer.next();
  const peek = (): TokenKind => cur.kind;
  const advance = (): Token => (cur = lexer.next());
  const expect = (kind: TokenKind): boolean => {
    if (peek() === kind) { advance(); return true; }
    return false;
  };
  const resyncAtSemi = (): void => {
    while (peek() !== "EOF" && peek() !== "SEMI") advance();
    if (peek() === "SEMI") advance();
  };

  while (peek() !== "EOF") {
    // Statements always start at a `#REF`. Skip any noise (the
    // tail of `ENDSEC;`, stray semicolons, etc.) until we find one.
    if (peek() !== "REF") {
      advance();
      continue;
    }
    const ref = parseInt(cur.text, 10);
    advance();
    if (!expect("EQ"))     { resyncAtSemi(); continue; }

    // Two shapes here:
    //   #N = TYPE (args);          — single-type entity
    //   #N = ( TYPE1(...) TYPE2(...) ... );   — complex entity (multi-type)
    //
    // The complex form (used for select-type subtyping) is rare in
    // most files but legal per ISO 10303-21 §10. Fold a complex
    // entity into a synthetic `Entity` with `type = ""` and
    // `args = [list of typed values]`; downstream walkers don't
    // currently use complex entities, so dropping the structural
    // detail keeps the graph shape uniform.

    if (peek() === "LPAREN") {
      // Complex entity.
      advance();
      const items: Value[] = [];
      while (peek() !== "RPAREN" && peek() !== "EOF") {
        const v = parseValue();
        if (v) items.push(v);
        else break;
      }
      expect("RPAREN");
      const e: Entity = {ref, type: "", args: items};
      byRef.set(ref, e);
      // No bucket for type-empty entities — kept reachable via byRef.
      expect("SEMI");
      continue;
    }

    if (peek() !== "IDENT") { resyncAtSemi(); continue; }
    const type = cur.text;
    advance();
    if (!expect("LPAREN"))  { resyncAtSemi(); continue; }

    const args: Value[] = [];
    if (peek() !== "RPAREN") {
      while (true) {
        const v = parseValue();
        if (v) args.push(v);
        if (peek() === "COMMA") { advance(); continue; }
        break;
      }
    }
    expect("RPAREN");
    expect("SEMI");

    const entity: Entity = {ref, type, args};
    byRef.set(ref, entity);
    let bucket = byType.get(type);
    if (!bucket) {
      bucket = [];
      byType.set(type, bucket);
    }
    bucket.push(entity);
  }

  // Build the inverse ref index. One pass over every entity, walks
  // the arg trees collecting (target → referring entity) pairs.
  // Refs inside lists / typed parameters / nested lists are all
  // captured. A given entity appears at most once per target — we
  // dedupe via a per-entity Set so a list of (#5,#5,#5) doesn't
  // bloat the bucket with three copies of the same parent.
  const referrers = new Map<number, Entity[]>();
  const seen = new Set<number>();
  for (const e of byRef.values()) {
    seen.clear();
    for (const arg of e.args) collectRefs(arg, seen);
    for (const target of seen) {
      let bucket = referrers.get(target);
      if (!bucket) { bucket = []; referrers.set(target, bucket); }
      bucket.push(e);
    }
  }

  return {byRef, byType, referrers};


  // ── parseValue ──────────────────────────────────────────────────
  // Recursive — bottoms out on terminals (REF, STR, NUM, ENUM,
  // DOLLAR, STAR), recurses on lists `( ... )` and typed parameters
  // `IDENT ( ... )`. Returns null on malformed input so the caller
  // can resync.
  function parseValue(): Value | null {
    switch (cur.kind) {
      case "REF": {
        const v: Value = {kind: "ref", ref: parseInt(cur.text, 10)};
        advance();
        return v;
      }
      case "STR": {
        const v: Value = {kind: "str", value: cur.text};
        advance();
        return v;
      }
      case "NUM": {
        const v: Value = {kind: "num", value: parseFloat(cur.text)};
        advance();
        return v;
      }
      case "ENUM": {
        const v: Value = {kind: "enum", name: cur.text};
        advance();
        return v;
      }
      case "DOLLAR": {
        advance();
        return {kind: "null"};
      }
      case "STAR": {
        advance();
        return {kind: "derived"};
      }
      case "LPAREN": {
        advance();
        const items: Value[] = [];
        if (peek() !== "RPAREN") {
          while (true) {
            const v = parseValue();
            if (v) items.push(v);
            if (peek() === "COMMA") { advance(); continue; }
            break;
          }
        }
        expect("RPAREN");
        return {kind: "list", items};
      }
      case "IDENT": {
        // Typed parameter: `NAME ( ... )`. If no `(` follows, treat
        // as enum-like name (rare, but lets us recover).
        const type = cur.text;
        advance();
        if (peek() !== "LPAREN") {
          return {kind: "enum", name: type};
        }
        advance();
        const args: Value[] = [];
        if (peek() !== "RPAREN") {
          while (true) {
            const v = parseValue();
            if (v) args.push(v);
            if (peek() === "COMMA") { advance(); continue; }
            break;
          }
        }
        expect("RPAREN");
        return {kind: "typed", type, args};
      }
      default:
        return null;
    }
  }
}


// ── Argument-shape helpers ──────────────────────────────────────────
// Walkers reach through `entity.args[i]` constantly; these typed
// accessors keep call sites readable without a slew of `as` casts.
// All return `undefined` for the wrong shape.

export function strArg(v: Value | undefined): string | undefined {
  return v && v.kind === "str" ? v.value : undefined;
}

export function refArg(v: Value | undefined): number | undefined {
  return v && v.kind === "ref" ? v.ref : undefined;
}

export function numArg(v: Value | undefined): number | undefined {
  return v && v.kind === "num" ? v.value : undefined;
}

export function listArg(v: Value | undefined): Value[] | undefined {
  return v && v.kind === "list" ? v.items : undefined;
}

export function enumArg(v: Value | undefined): string | undefined {
  return v && v.kind === "enum" ? v.name : undefined;
}

/**
 * Walk `value` and add every `#ref` it mentions to `out`. Refs
 * inside lists and typed parameters are all collected; the Set
 * dedupes so a list with the same target three times only adds
 * one entry.
 */
function collectRefs(value: Value, out: Set<number>): void {
  switch (value.kind) {
    case "ref":
      out.add(value.ref);
      return;
    case "list":
      for (const item of value.items) collectRefs(item, out);
      return;
    case "typed":
      for (const arg of value.args) collectRefs(arg, out);
      return;
    default:
      return;
  }
}
