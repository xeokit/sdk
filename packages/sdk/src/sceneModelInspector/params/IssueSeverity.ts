/**
 * Severity tier for an {@link Issue}.
 *
 *   - `"error"` — invariant violation that the renderer or
 *     {@link optimizeSceneModel} can't safely tolerate. Blocks
 *     downstream passes.
 *   - `"warning"` — conditions that render but waste GPU or
 *     look wrong. Advisory; downstream passes proceed.
 *   - `"info"` — informational findings; never blocks anything.
 *     Reserved for future inspections (e.g. deduplication
 *     opportunities flagged for the user's awareness).
 */
export type IssueSeverity = "error" | "warning" | "info";
