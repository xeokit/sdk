/**
 * STEP (ISO 10303-21) lexer.
 *
 * STEP is plain ASCII with a small token set; the file format is
 * specified in ISO 10303-21 §6 ("character set and tokens"). This
 * lexer covers the subset that occurs in real-world AP203 / AP214 /
 * AP242 files:
 *
 *   - Punctuation: `( ) , = ; $ *`
 *   - References: `#42`
 *   - Strings: `'text'` with `''` representing a literal quote
 *     (per §6.4.3). The `\X\..\X0\` Unicode escape is rare in
 *     modern files and intentionally not handled — bytes pass
 *     through verbatim.
 *   - Numbers: integer / decimal / scientific (`-1.5E+02`)
 *   - Enumerations: `.NAME.` (e.g. `.T.` for true)
 *   - Identifiers: `LETTER (LETTER | DIGIT | _)*` — entity type
 *     names and typed-parameter names (used for select types).
 *
 * Comments (`/* ... *\/`) and ASCII whitespace are skipped between
 * tokens. Performance is fine for files up to ~50MB; for larger
 * inputs the inner loop's `charCodeAt` use keeps the hot path off
 * regexes.
 *
 * @internal
 */

export type TokenKind =
  | "REF"
  | "STR"
  | "NUM"
  | "ENUM"
  | "IDENT"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EQ"
  | "SEMI"
  | "DOLLAR"
  | "STAR"
  | "EOF";

export interface Token {
  kind: TokenKind;
  /** For STR: the unescaped string value. For REF: the digits.
   *  For NUM: the raw text. For ENUM / IDENT: the name. */
  text: string;
  /** Byte offset into the source — useful for error reporting. */
  pos: number;
}

const CH_TAB    = 0x09;
const CH_LF     = 0x0A;
const CH_CR     = 0x0D;
const CH_SPACE  = 0x20;
const CH_QUOTE  = 0x27;  // '
const CH_LPAREN = 0x28;
const CH_RPAREN = 0x29;
const CH_STAR   = 0x2A;
const CH_PLUS   = 0x2B;
const CH_COMMA  = 0x2C;
const CH_MINUS  = 0x2D;
const CH_DOT    = 0x2E;
const CH_SLASH  = 0x2F;
const CH_0      = 0x30;
const CH_9      = 0x39;
const CH_SEMI   = 0x3B;
const CH_EQ     = 0x3D;
const CH_HASH   = 0x23;
const CH_DOLLAR = 0x24;
const CH_A      = 0x41;
const CH_E_UP   = 0x45;
const CH_Z_UP   = 0x5A;
const CH_E_LO   = 0x65;
const CH_USCORE = 0x5F;
const CH_a      = 0x61;
const CH_z      = 0x7A;

export class Lexer {

  private readonly text: string;
  private readonly len: number;
  private pos: number = 0;

  constructor(text: string) {
    this.text = text;
    this.len  = text.length;
  }

  /** Current byte offset. Useful for error context. */
  get position(): number {
    return this.pos;
  }

  next(): Token {
    this.skipTrivia();
    if (this.pos >= this.len) {
      return {kind: "EOF", text: "", pos: this.pos};
    }
    const start = this.pos;
    const ch = this.text.charCodeAt(this.pos);

    // Single-char punctuation.
    switch (ch) {
      case CH_LPAREN: this.pos++; return {kind: "LPAREN", text: "(", pos: start};
      case CH_RPAREN: this.pos++; return {kind: "RPAREN", text: ")", pos: start};
      case CH_COMMA:  this.pos++; return {kind: "COMMA",  text: ",", pos: start};
      case CH_EQ:     this.pos++; return {kind: "EQ",     text: "=", pos: start};
      case CH_SEMI:   this.pos++; return {kind: "SEMI",   text: ";", pos: start};
      case CH_DOLLAR: this.pos++; return {kind: "DOLLAR", text: "$", pos: start};
      case CH_STAR:   this.pos++; return {kind: "STAR",   text: "*", pos: start};
    }

    // Reference: `#<digits>`.
    if (ch === CH_HASH) {
      this.pos++;
      const numStart = this.pos;
      while (this.pos < this.len && isDigit(this.text.charCodeAt(this.pos))) this.pos++;
      return {kind: "REF", text: this.text.substring(numStart, this.pos), pos: start};
    }

    // String: `'...'` with `''` escape.
    if (ch === CH_QUOTE) {
      return this.readString(start);
    }

    // Enumeration: `.NAME.`.
    if (ch === CH_DOT &&
        this.pos + 1 < this.len &&
        isIdentStart(this.text.charCodeAt(this.pos + 1))) {
      this.pos++;
      const nameStart = this.pos;
      while (this.pos < this.len && isIdentPart(this.text.charCodeAt(this.pos))) this.pos++;
      const name = this.text.substring(nameStart, this.pos);
      // Closing `.` — tolerant: if missing, surface what we have.
      if (this.pos < this.len && this.text.charCodeAt(this.pos) === CH_DOT) this.pos++;
      return {kind: "ENUM", text: name, pos: start};
    }

    // Number: optional sign, digits, optional fraction, optional
    // exponent. Standalone `-` and `+` aren't valid here, but a
    // bare `.` followed by non-letter would land in number mode
    // and read 0 digits — caller will see an empty NUM and skip.
    if (isDigit(ch) || ch === CH_MINUS || ch === CH_PLUS || ch === CH_DOT) {
      return this.readNumber(start);
    }

    // Identifier: entity type names + typed parameters.
    if (isIdentStart(ch)) {
      while (this.pos < this.len && isIdentPart(this.text.charCodeAt(this.pos))) this.pos++;
      return {kind: "IDENT", text: this.text.substring(start, this.pos), pos: start};
    }

    // Unknown — advance past and surface a synthetic IDENT so the
    // parser can recover statement-by-statement.
    this.pos++;
    return {kind: "IDENT", text: this.text.substring(start, this.pos), pos: start};
  }


  // ── Internals ──────────────────────────────────────────────────

  private skipTrivia(): void {
    while (this.pos < this.len) {
      const ch = this.text.charCodeAt(this.pos);
      if (ch === CH_SPACE || ch === CH_TAB || ch === CH_LF || ch === CH_CR) {
        this.pos++;
        continue;
      }
      // `/* ... */` comment.
      if (ch === CH_SLASH &&
          this.pos + 1 < this.len &&
          this.text.charCodeAt(this.pos + 1) === CH_STAR) {
        this.pos += 2;
        while (this.pos + 1 < this.len &&
               !(this.text.charCodeAt(this.pos) === CH_STAR &&
                 this.text.charCodeAt(this.pos + 1) === CH_SLASH)) {
          this.pos++;
        }
        // Advance past `*/` (or to EOF if the comment is unterminated).
        this.pos = Math.min(this.pos + 2, this.len);
        continue;
      }
      break;
    }
  }

  private readString(start: number): Token {
    this.pos++; // consume opening quote
    // Fast path: most strings have no `''` escapes — slice in one go
    // without building a per-char accumulator. Fall back to the slow
    // path when we hit an escape.
    const fastStart = this.pos;
    while (this.pos < this.len) {
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_QUOTE) {
        if (this.pos + 1 < this.len &&
            this.text.charCodeAt(this.pos + 1) === CH_QUOTE) {
          // Escape — switch to slow path with what we have so far.
          let out = this.text.substring(fastStart, this.pos);
          this.pos += 2;
          out += "'";
          while (this.pos < this.len) {
            const cc = this.text.charCodeAt(this.pos);
            if (cc === CH_QUOTE) {
              if (this.pos + 1 < this.len &&
                  this.text.charCodeAt(this.pos + 1) === CH_QUOTE) {
                out += "'";
                this.pos += 2;
                continue;
              }
              this.pos++;
              return {kind: "STR", text: out, pos: start};
            }
            out += this.text[this.pos++];
          }
          // Unterminated — return what we collected.
          return {kind: "STR", text: out, pos: start};
        }
        // Closing quote.
        const text = this.text.substring(fastStart, this.pos);
        this.pos++;
        return {kind: "STR", text, pos: start};
      }
      this.pos++;
    }
    // Unterminated string — surface what we have.
    return {kind: "STR", text: this.text.substring(fastStart, this.pos), pos: start};
  }

  private readNumber(start: number): Token {
    const ch0 = this.text.charCodeAt(this.pos);
    if (ch0 === CH_MINUS || ch0 === CH_PLUS) this.pos++;
    while (this.pos < this.len && isDigit(this.text.charCodeAt(this.pos))) this.pos++;
    if (this.pos < this.len && this.text.charCodeAt(this.pos) === CH_DOT) {
      this.pos++;
      while (this.pos < this.len && isDigit(this.text.charCodeAt(this.pos))) this.pos++;
    }
    if (this.pos < this.len) {
      const e = this.text.charCodeAt(this.pos);
      if (e === CH_E_LO || e === CH_E_UP) {
        this.pos++;
        if (this.pos < this.len) {
          const sign = this.text.charCodeAt(this.pos);
          if (sign === CH_MINUS || sign === CH_PLUS) this.pos++;
        }
        while (this.pos < this.len && isDigit(this.text.charCodeAt(this.pos))) this.pos++;
      }
    }
    return {kind: "NUM", text: this.text.substring(start, this.pos), pos: start};
  }
}

function isDigit(ch: number): boolean {
  return ch >= CH_0 && ch <= CH_9;
}
function isIdentStart(ch: number): boolean {
  return (ch >= CH_A && ch <= CH_Z_UP) ||
         (ch >= CH_a && ch <= CH_z) ||
         ch === CH_USCORE;
}
function isIdentPart(ch: number): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
