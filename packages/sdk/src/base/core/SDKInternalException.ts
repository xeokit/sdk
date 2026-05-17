/**
 * Represents an unexpected internal SDK error condition.
 *
 * This exception type is used exclusively inside the SDK to signal failures
 * caused by bugs, invalid internal state, or violated invariants. It is **never**
 * intended to be thrown directly to SDK consumers.
 *
 * Instead, public-facing errors should use {@link base!core.SDKResult | SDKResult}, so that user code
 * receives structured, predictable failure information.
 *
 * Throwing an `SDKInternalException` indicates a logic error in the SDK itself
 * and should generally be considered a development-time or diagnostic event.
 */
export class SDKInternalException extends Error {

  /**
   * Creates a new internal SDK exception.
   *
   * @param message A descriptive message explaining the unexpected condition.
   */
  constructor(message?: string) {
    super(message);
    this.name = "SDKInternalException";
  }
}
