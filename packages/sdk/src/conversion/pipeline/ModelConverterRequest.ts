/**
 * Parameters required to perform a conversion using {@link ModelConverter.convert | ModelConverter.convert}.
 */
export interface ModelConverterRequest {

  /**
   * The identifier of the pipeline to use for this conversion.
   * Must match the name of a registered pipeline in the converter.
   */
  pipeline: string;

  /**
   * Input data for the selected pipeline, keyed by input name.
   * Each key should correspond to a defined pipeline input.
   */
  inputs: {
    [key: string]: FileRef
  };

  /**
   * Output data for the selected pipeline, keyed by output name.
   * Each key should correspond to a defined pipeline ouput.
   */
  outputs: {
    [key: string]: FileRef
  };

  /**
   * Select reporters to report on results.
   * Each key should correspond to a supported report type.
   */
  reports: {
    [key: string]: FileRef
  };

  /**
   * Optional `AbortSignal` propagated through the entire
   * conversion: every pipeline input's loader, every output's
   * exporter, the per-model inspection pass, and the
   * between-phase yields all check `signal.aborted` and throw
   * a `DOMException("Aborted", "AbortError")` when the caller
   * cancels. If a per-step `options.signal` is also supplied on
   * a pipeline input or output, the request-level signal wins —
   * cancelling one call should cancel every step.
   */
  signal?: AbortSignal;

  /**
   * Optional yield-throttle interval (in milliseconds) applied
   * for the entire conversion. {@link ModelConverter.convert |
   * ModelConverter.convert} pushes this onto the global override
   * via {@link base!utils.setYieldIntervalOverride |
   * setYieldIntervalOverride} so every
   * {@link base!utils.yieldToHost | yieldToHost} call inside
   * loaders / exporters / inspectors picks it up without
   * having to thread the value through every options object.
   * Restored in a `finally` so nested converter invocations
   * stack cleanly.
   *
   * Defaults to the library default (~16 ms / 60 Hz). Raise to
   * 50–100 ms to trade UI smoothness for raw conversion speed
   * on long-running CLI batches; on a headless Node run
   * (`xeoconvert`) yields don't help anyone so a value of a few
   * seconds essentially disables them.
   */
  yieldIntervalMs?: number;
}

/**
 * Reference to a file, either by path or by data.
 */
export interface FileRef {
  filePath?: string;
  fileData?: any;
}
