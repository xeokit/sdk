/**
 * Owns WebGPU lighting defaults and writes lighting uniforms.
 *
 * @internal
 */
export class LightingManager {

  private readonly _lightDirection = new Float32Array([-0.35, 0.55, 0.76]);
  private readonly _ambient = 0.35;

  constructor() {
    this._normalizeLightDirection();
  }

  public writeLightingUniforms(target: Float32Array, offset: number): void {
    target[offset] = this._lightDirection[0];
    target[offset + 1] = this._lightDirection[1];
    target[offset + 2] = this._lightDirection[2];
    target[offset + 3] = this._ambient;
  }

  private _normalizeLightDirection(): void {
    const x = this._lightDirection[0];
    const y = this._lightDirection[1];
    const z = this._lightDirection[2];
    const length = Math.hypot(x, y, z) || 1;
    this._lightDirection[0] = x / length;
    this._lightDirection[1] = y / length;
    this._lightDirection[2] = z / length;
  }
}
