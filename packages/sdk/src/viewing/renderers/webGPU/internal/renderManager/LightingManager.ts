import {
  HEMISPHERE_GROUND_UNIFORM_OFFSET,
  HEMISPHERE_SKY_UNIFORM_OFFSET,
  HEMISPHERE_UP_UNIFORM_OFFSET
} from "../constants";

/**
 * Owns WebGPU lighting extraction and writes lighting uniforms.
 *
 * @internal
 */
export class LightingManager {

  private readonly _defaultAmbient = new Float32Array([0.5, 0.5, 0.5, 1.0]);
  private readonly _ambientScratch = new Float32Array(4);

  public writeLightingUniforms(view: any, target: Float32Array, offset: number): void {
    const ambient = this._getAmbientLight(view);
    target[offset + 0] = ambient[0];
    target[offset + 1] = ambient[1];
    target[offset + 2] = ambient[2];
    target[offset + 3] = ambient[3];

    const lights = (view?.lightsList || []) as any[];
    let lightIndex = 0;
    for (let i = 0, len = lights.length; i < len && lightIndex < 3; i++) {
      const light = lights[i];
      if (!this._isDirectionalLight(light)) {
        continue;
      }
      this._writeDirectionalLight(view, light, target, offset, lightIndex);
      lightIndex++;
    }
    for (; lightIndex < 3; lightIndex++) {
      const dirOffset = offset + 4 + lightIndex * 4;
      const colorOffset = offset + 16 + lightIndex * 4;
      target[dirOffset + 0] = 0;
      target[dirOffset + 1] = 1;
      target[dirOffset + 2] = 1;
      target[dirOffset + 3] = 0;
      target[colorOffset + 0] = 0;
      target[colorOffset + 1] = 0;
      target[colorOffset + 2] = 0;
      target[colorOffset + 3] = 0;
    }

    this._writeHemisphereAmbient(view, target);
  }

  private _getAmbientLight(view: any): Float32Array {
    const lights = (view?.lightsList || []) as any[];
    for (let i = 0, len = lights.length; i < len; i++) {
      const light = lights[i];
      if (this._isAmbientLight(light)) {
        const intensity = this._getLightIntensity(light);
        this._ambientScratch[0] = light.color?.[0] ?? 0.5;
        this._ambientScratch[1] = light.color?.[1] ?? 0.5;
        this._ambientScratch[2] = light.color?.[2] ?? 0.5;
        this._ambientScratch[3] = intensity;
        return this._ambientScratch;
      }
    }
    return this._defaultAmbient;
  }

  private _writeDirectionalLight(view: any, light: any, target: Float32Array, offset: number, lightIndex: number): void {
    const dir = light.dir || [0, 1, 1];
    const dirLength = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const sx = dir[0] / dirLength;
    const sy = dir[1] / dirLength;
    const sz = dir[2] / dirLength;
    const viewMatrix = view?.camera?.viewMatrix;
    const transformToWorld = light.space !== "world" && viewMatrix;
    const wx = transformToWorld ? viewMatrix[0] * sx + viewMatrix[1] * sy + viewMatrix[2] * sz : sx;
    const wy = transformToWorld ? viewMatrix[4] * sx + viewMatrix[5] * sy + viewMatrix[6] * sz : sy;
    const wz = transformToWorld ? viewMatrix[8] * sx + viewMatrix[9] * sy + viewMatrix[10] * sz : sz;
    const worldLength = Math.hypot(wx, wy, wz) || 1;
    const dirOffset = offset + 4 + lightIndex * 4;
    const colorOffset = offset + 16 + lightIndex * 4;
    target[dirOffset + 0] = wx / worldLength;
    target[dirOffset + 1] = wy / worldLength;
    target[dirOffset + 2] = wz / worldLength;
    target[dirOffset + 3] = 0;
    target[colorOffset + 0] = light.color?.[0] ?? 0;
    target[colorOffset + 1] = light.color?.[1] ?? 0;
    target[colorOffset + 2] = light.color?.[2] ?? 0;
    target[colorOffset + 3] = this._getLightIntensity(light);
  }

  private _isAmbientLight(light: any): boolean {
    return !!light && light.dir === undefined && light.pos === undefined && light.color !== undefined && light.intensity !== undefined;
  }

  private _isDirectionalLight(light: any): boolean {
    return !!light && light.dir !== undefined && light.pos === undefined;
  }

  private _getLightIntensity(light: any): number {
    return light?.intensity !== undefined ? light.intensity : 1.0;
  }

  private _writeHemisphereAmbient(view: any, target: Float32Array): void {
    const hemisphere = view?.lights?.hemispheric;
    const applied = !!(hemisphere?.applied && hemisphere?.possible);
    const intensity = applied ? Math.max(0, Number(hemisphere.intensity ?? 1.0)) : 0;
    const sky = hemisphere?.skyColor || [0.62, 0.72, 0.86];
    const ground = hemisphere?.groundColor || [0.42, 0.36, 0.30];
    const up = hemisphere?.worldUp || [0, 0, 1];
    const upLength = Math.hypot(up[0] ?? 0, up[1] ?? 0, up[2] ?? 0);
    const upX = upLength > 0 ? (up[0] ?? 0) / upLength : 0;
    const upY = upLength > 0 ? (up[1] ?? 0) / upLength : 0;
    const upZ = upLength > 0 ? (up[2] ?? 0) / upLength : 1;

    target[HEMISPHERE_SKY_UNIFORM_OFFSET + 0] = sky[0] ?? 0.62;
    target[HEMISPHERE_SKY_UNIFORM_OFFSET + 1] = sky[1] ?? 0.72;
    target[HEMISPHERE_SKY_UNIFORM_OFFSET + 2] = sky[2] ?? 0.86;
    target[HEMISPHERE_SKY_UNIFORM_OFFSET + 3] = intensity;

    target[HEMISPHERE_GROUND_UNIFORM_OFFSET + 0] = ground[0] ?? 0.42;
    target[HEMISPHERE_GROUND_UNIFORM_OFFSET + 1] = ground[1] ?? 0.36;
    target[HEMISPHERE_GROUND_UNIFORM_OFFSET + 2] = ground[2] ?? 0.30;
    target[HEMISPHERE_GROUND_UNIFORM_OFFSET + 3] = 0;

    target[HEMISPHERE_UP_UNIFORM_OFFSET + 0] = upX;
    target[HEMISPHERE_UP_UNIFORM_OFFSET + 1] = upY;
    target[HEMISPHERE_UP_UNIFORM_OFFSET + 2] = upZ;
    target[HEMISPHERE_UP_UNIFORM_OFFSET + 3] = 0;
  }
}
