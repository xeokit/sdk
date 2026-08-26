/**
 * Shared packed-position contract for WebGPU triangle techniques.
 *
 * Positions are uploaded as unorm16x4 and decoded in the vertex shader with a
 * segment-local min/extent uniform. CPU-side decoded float positions remain in
 * RendererGeometry for picking and snapping math.
 *
 * @internal
 */
export const TRIANGLE_POSITION_DECODE_UNIFORM_FLOATS = 8;

/**
 * @internal
 */
export const TRIANGLE_POSITION_DECODE_UNIFORM_BYTES = TRIANGLE_POSITION_DECODE_UNIFORM_FLOATS * 4;

/**
 * @internal
 */
export const PACKED_TRIANGLE_POSITION_VERTEX_BUFFER_LAYOUTS = [
  {
    arrayStride: 8,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: "unorm16x4"
    }]
  },
  {
    arrayStride: 8,
    attributes: [{
      shaderLocation: 1,
      offset: 0,
      format: "uint32x2"
    }]
  }
];

/**
 * @internal
 */
export const TRIANGLE_POSITION_DECODE_WGSL = `
struct PositionDecode {
  min: vec4<f32>,
  extent: vec4<f32>,
};

@group(2) @binding(0) var<storage, read> positionDecodes: array<PositionDecode>;

fn decodePackedPosition(packedPosition: vec4<f32>, decodeIndex: u32) -> vec3<f32> {
  let positionDecode = positionDecodes[decodeIndex];
  return positionDecode.min.xyz + packedPosition.xyz * positionDecode.extent.xyz;
}
`;

/**
 * Shared RTC tile contract for WebGPU triangle techniques.
 *
 * Mesh instance matrices are uploaded relative to a dynamically assigned RTC
 * tile. The tile index is stored in MeshInstance.flags.y.
 *
 * @internal
 */
export const TRIANGLE_RTC_TILE_WGSL = `
struct RTCTile {
  viewProjection: mat4x4<f32>,
  center: vec4<f32>,
};

@group(0) @binding(1) var<storage, read> rtcTiles: array<RTCTile>;

fn getInstanceRTCTile(instance: MeshInstance) -> RTCTile {
  return rtcTiles[u32(instance.flags.y)];
}
`;
