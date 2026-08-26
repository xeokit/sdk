/**
 * Options for {@link createAircraftNoiseBuffer}.
 */
export interface AircraftNoiseBufferParams {
  /** Length of the generated mono buffer. Defaults to two seconds. */
  durationSeconds?: number;
  /** Seed for the deterministic linear-congruential noise generator. */
  seed?: number;
}

/**
 * Creates a deterministic mono white-noise AudioBuffer.
 *
 * This is useful for simple aircraft engine or wind noise layers in demos.
 * The generated samples are deterministic for a given seed so examples remain
 * stable across reloads.
 *
 * @param context Web Audio context used to allocate the buffer.
 * @param params Optional duration and seed.
 *
 * @example
 * ```ts
 * const buffer = createAircraftNoiseBuffer(audioContext, {
 *   durationSeconds: 3,
 *   seed: 1234
 * });
 *
 * const source = audioContext.createBufferSource();
 * source.buffer = buffer;
 * source.loop = true;
 * source.connect(audioContext.destination);
 * source.start();
 * ```
 */
export function createAircraftNoiseBuffer(
  context: BaseAudioContext,
  {durationSeconds = 2, seed = 0x9e3779b9}: AircraftNoiseBufferParams = {}
): AudioBuffer {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = seed >>> 0;
  for (let i = 0; i < sampleCount; i++) {
    value = (1664525 * value + 1013904223) >>> 0;
    data[i] = (value / 0xffffffff) * 2 - 1;
  }
  return buffer;
}
