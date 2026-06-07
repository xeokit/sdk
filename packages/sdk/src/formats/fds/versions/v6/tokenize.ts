import type {FDSRecord} from "./types";

/**
 * Tokenises FDS namelist text into a stream of {@link FDSRecord}s.
 *
 * Grammar (lenient — matches what FDS-6 input files actually use, not
 * a strict Fortran namelist):
 *
 * ```
 *   record   = "&" GROUP ws (param)*  ws "/"
 *   param    = NAME ws "=" ws value (("," | ws) param)?
 *   value    = number | string | bool | array
 *   string   = "'" ... "'" | "\"" ... "\""
 *   bool     = ".TRUE." | ".T." | ".FALSE." | ".F."
 *   array    = value ("," value)*
 *   comment  = "!" ... EOL
 * ```
 *
 * Records can span multiple lines. Comments (`!` to end of line) are
 * stripped before tokenizing.
 *
 * @internal
 */
export function tokenize(input: string): FDSRecord[] {
  const records: FDSRecord[] = [];
  const stripped = stripComments(input);
  let i = 0;
  let line = 1;
  const len = stripped.length;

  while (i < len) {
    // Track line numbers across whitespace runs so a record's reported
    // line is the one where `&GROUP` appeared.
    while (i < len && stripped[i] !== "&") {
      if (stripped[i] === "\n") line++;
      i++;
    }
    if (i >= len) break;

    const recordLine = line;
    i++;  // past '&'

    // Group id — uppercase letters/digits/underscore.
    const groupStart = i;
    while (i < len && isIdent(stripped[i])) i++;
    const group = stripped.slice(groupStart, i).toUpperCase();
    if (!group) {
      // Lone '&' with no identifier — skip.
      continue;
    }

    const params = new Map<string, unknown>();

    // Walk params until the closing '/'. Track newlines along the way.
    while (i < len) {
      // Skip whitespace + commas (param separators are interchangeable).
      while (i < len && (isSpace(stripped[i]) || stripped[i] === ",")) {
        if (stripped[i] === "\n") line++;
        i++;
      }
      if (i >= len) break;
      if (stripped[i] === "/") { i++; break; }

      // Param name.
      const nameStart = i;
      while (i < len && (isIdent(stripped[i]) || stripped[i] === "(" || stripped[i] === ")" || isDigit(stripped[i]))) {
        i++;
      }
      const name = stripped.slice(nameStart, i).toUpperCase();
      if (!name) {
        // Couldn't parse a name — bail this record to avoid a runaway loop.
        // Advance until next '&' or '/' so the next record can resume.
        while (i < len && stripped[i] !== "&" && stripped[i] !== "/") {
          if (stripped[i] === "\n") line++;
          i++;
        }
        break;
      }

      // '='.
      while (i < len && isSpace(stripped[i])) {
        if (stripped[i] === "\n") line++;
        i++;
      }
      if (i >= len || stripped[i] !== "=") {
        // Malformed; skip ahead defensively.
        continue;
      }
      i++;  // past '='

      // Value(s) — read tokens separated by ',' until we hit a name (NAME=)
      // or the closing '/' or another whitespace-separated token that
      // looks like a NAME=.
      const values: unknown[] = [];
      let firstTokenLine = line;
      void firstTokenLine;  // reserved for future use (error reporting)

      // Skip space before the first value.
      while (i < len && (isSpace(stripped[i]))) {
        if (stripped[i] === "\n") line++;
        i++;
      }

      readValues: while (i < len) {
        if (stripped[i] === "/") break readValues;

        // Lookahead: is this the start of the next NAME= rather than another value?
        if (isIdentStart(stripped[i])) {
          // Could be a value-style token (.TRUE., .FALSE.) or the next name.
          // A name is identified by being followed (after optional whitespace) by '='.
          const save = i;
          let j = i;
          while (j < len && (isIdent(stripped[j]) || stripped[j] === "(" || stripped[j] === ")" || isDigit(stripped[j]))) j++;
          let k = j;
          while (k < len && isSpace(stripped[k])) k++;
          if (k < len && stripped[k] === "=") {
            // It's the next NAME=, stop value reading. Don't consume.
            i = save;
            break readValues;
          }
          // Fall through and parse as a bareword value.
        }

        const v = readOneValue(stripped, i, len);
        if (!v) break readValues;
        values.push(v.value);
        // Update line for any newlines inside the parsed span.
        for (let p = i; p < v.next; p++) if (stripped[p] === "\n") line++;
        i = v.next;

        // After a value: skip whitespace + a single comma.
        while (i < len && isSpace(stripped[i])) {
          if (stripped[i] === "\n") line++;
          i++;
        }
        if (i < len && stripped[i] === ",") {
          i++;
          while (i < len && isSpace(stripped[i])) {
            if (stripped[i] === "\n") line++;
            i++;
          }
          continue;
        }
        // No comma → likely end of this param's values; bail and let the
        // outer loop decide whether we're at the next NAME= or at '/'.
        break readValues;
      }

      // Reduce to a single value when only one token was found; keep an
      // array for genuine arrays (and 1-element values that the caller
      // expects as arrays — like XB — are pulled out at dispatch time).
      const stored: unknown = values.length === 1 ? values[0] : values;
      params.set(name, stored);
    }

    records.push({group, line: recordLine, params});
  }

  return records;
}

// ───────── helpers ─────────

function stripComments(src: string): string {
  // Strip '!' to end of line, but respect quoted strings so a '!' inside a
  // SURF_ID like 'WIRE_!_CAGE' doesn't truncate the line. Walks once.
  let out = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!inSingle && !inDouble && c === "!") {
      while (i < src.length && src[i] !== "\n") i++;
      out += src[i] ?? "";
      continue;
    }
    if (!inDouble && c === "'") inSingle = !inSingle;
    else if (!inSingle && c === "\"") inDouble = !inDouble;
    out += c;
  }
  return out;
}

function isSpace(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_" || c === ".";
}

function isIdent(c: string): boolean {
  return isIdentStart(c) || isDigit(c) || c === "_";
}

/**
 * Reads one scalar value starting at `src[start]`. Returns the parsed
 * value and the index of the first char *after* the value. Returns
 * `null` for an unparseable token so the caller can recover.
 */
function readOneValue(src: string, start: number, end: number): {value: unknown; next: number} | null {
  const c = src[start];

  // Quoted string.
  if (c === "'" || c === "\"") {
    const quote = c;
    let i = start + 1;
    let out = "";
    while (i < end) {
      if (src[i] === quote) {
        // FDS doesn't support escapes; a doubled quote inside a string
        // is rare and not standard. Stop at the first close quote.
        return {value: out, next: i + 1};
      }
      out += src[i];
      i++;
    }
    // Unterminated string — return what we have.
    return {value: out, next: end};
  }

  // Booleans.
  const upper = src.slice(start, Math.min(end, start + 8)).toUpperCase();
  if (upper.startsWith(".TRUE.")) return {value: true,  next: start + 6};
  if (upper.startsWith(".T."))    return {value: true,  next: start + 3};
  if (upper.startsWith(".FALSE."))return {value: false, next: start + 7};
  if (upper.startsWith(".F."))    return {value: false, next: start + 3};

  // Number — sign, digits, optional decimal, optional exponent.
  let i = start;
  if (src[i] === "+" || src[i] === "-") i++;
  let hasDigit = false;
  while (i < end && isDigit(src[i])) { i++; hasDigit = true; }
  if (i < end && src[i] === ".") {
    i++;
    while (i < end && isDigit(src[i])) { i++; hasDigit = true; }
  }
  if (hasDigit && i < end && (src[i] === "E" || src[i] === "e" || src[i] === "D" || src[i] === "d")) {
    i++;
    if (i < end && (src[i] === "+" || src[i] === "-")) i++;
    while (i < end && isDigit(src[i])) i++;
  }
  if (hasDigit) {
    // FDS uses Fortran's 'D' exponent for double precision; normalise to 'E'
    // so parseFloat can read it.
    const raw = src.slice(start, i).replace(/[dD]/, "e");
    const n = parseFloat(raw);
    return {value: n, next: i};
  }

  // Bareword (unquoted identifier value — uncommon, treat as string).
  if (isIdentStart(c)) {
    let j = start;
    while (j < end && isIdent(src[j])) j++;
    return {value: src.slice(start, j), next: j};
  }

  return null;
}
