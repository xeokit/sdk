/**
 * Severity tier for an {@link Issue}.
 *
 *   - `"error"` — invariant violation (dangling references, schema mismatch).
 *   - `"warning"` — likely authoring mistake; loads but advisory.
 *   - `"info"` — informational; reserved.
 */
export type IssueSeverity = "error" | "warning" | "info";
