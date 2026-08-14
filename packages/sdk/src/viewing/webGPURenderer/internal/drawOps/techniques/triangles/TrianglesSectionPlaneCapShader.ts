/**
 * WGSL shader for the WebGPU section-plane cap plane pass.
 *
 * @internal
 */
export const TRIANGLES_SECTION_PLANE_CAP_SHADER = `
struct CapPlaneUniforms {
  invViewProjection: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  eyeAndViewportWidth: vec4<f32>,
  capPlane: vec4<f32>,
  capColor: vec4<f32>,
  otherPlanes: array<vec4<f32>, 8>,
  otherPlaneCount: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cap: CapPlaneUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

struct FragmentOutput {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex & 1u) << 2u) - 1.0;
  let y = f32((vertexIndex & 2u) << 1u) - 1.0;
  output.position = vec4<f32>(x, y, 0.0, 1.0);
  return output;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> FragmentOutput {
  let viewportWidth = cap.eyeAndViewportWidth.w;
  let viewportHeight = cap.otherPlaneCount.y;
  let eye = cap.eyeAndViewportWidth.xyz;
  let ndc = vec2<f32>(
    fragCoord.x / viewportWidth * 2.0 - 1.0,
    1.0 - fragCoord.y / viewportHeight * 2.0
  );
  let worldFarH = cap.invViewProjection * vec4<f32>(ndc, 1.0, 1.0);
  let worldFar = worldFarH.xyz / worldFarH.w;
  let rayDir = worldFar - eye;
  let denom = dot(cap.capPlane.xyz, rayDir);
  if (abs(denom) < 0.000001) {
    discard;
  }
  let t = -(dot(cap.capPlane.xyz, eye) + cap.capPlane.w) / denom;
  if (t <= 0.0) {
    discard;
  }
  let worldPos = eye + t * rayDir;
  let otherCount = u32(cap.otherPlaneCount.x);
  for (var i = 0u; i < 8u; i = i + 1u) {
    if (i >= otherCount) {
      break;
    }
    let plane = cap.otherPlanes[i];
    if (dot(plane.xyz, worldPos) + plane.w > 0.0) {
      discard;
    }
  }
  let clip = cap.viewProjection * vec4<f32>(worldPos, 1.0);
  if (clip.w <= 0.0) {
    discard;
  }
  let depth = clip.z / clip.w;
  if (depth < 0.0 || depth > 1.0) {
    discard;
  }
  var output: FragmentOutput;
  output.color = vec4<f32>(cap.capColor.rgb, 1.0);
  output.depth = depth;
  return output;
}
`;
