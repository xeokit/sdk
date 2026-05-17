import type {Inspection} from "./Inspection";


/**
 * Pluggable list of {@link Inspection | inspections}.
 *
 * Multiple inspections may claim the same code — they all run, all
 * contribute issues to the report. {@link unregister} is per-rule,
 * not per-code: it removes every inspection that lists `code`.
 */
export class InspectionRegistry {

  readonly #inspections: Inspection[] = [];

  constructor(inspections: Inspection[] = []) {
    for (const i of inspections) this.register(i);
  }

  register(inspection: Inspection): void {
    this.#inspections.push(inspection);
  }

  /** Unregister every inspection that claims `code`. Returns the
   *  number removed. */
  unregister(code: string): number {
    let removed = 0;
    for (let i = this.#inspections.length - 1; i >= 0; i--) {
      if (this.#inspections[i].codes.indexOf(code) !== -1) {
        this.#inspections.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  inspections(): readonly Inspection[] {
    return this.#inspections;
  }

  has(code: string): boolean {
    for (const insp of this.#inspections) {
      if (insp.codes.indexOf(code) !== -1) return true;
    }
    return false;
  }

  /** Iterator over every distinct code declared by any registered
   *  inspection. */
  codes(): IterableIterator<string> {
    const seen = new Set<string>();
    for (const insp of this.#inspections) {
      for (const c of insp.codes) seen.add(c);
    }
    return seen.values();
  }

  clear(): void {
    this.#inspections.length = 0;
  }
}
