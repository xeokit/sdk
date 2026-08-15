function frameUniformsWGSL(): string {
  return `
struct FrameUniforms {
  viewProjection: mat4x4<f32>,
  ambientLight: vec4<f32>,
  dirLightDirections: array<vec4<f32>, 3>,
  dirLightColors: array<vec4<f32>, 3>,
  sectionPlaneState: vec4<f32>,
  sectionPlanes: array<vec4<f32>, 8>,
  sectionPlaneCapColors: array<vec4<f32>, 8>,
  depthParams: vec4<f32>,
  pointParams0: vec4<f32>,
  pointParams1: vec4<f32>,
  lineParams: vec4<f32>,
  viewMatrix: mat4x4<f32>,
  splatParams: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
`;
}

function splatStorageWGSL(): string {
  return `
struct SplatRecord {
  t0: vec4<f32>,
  t1: vec4<f32>,
  t2: vec4<f32>,
  t3: vec4<f32>,
};

@group(1) @binding(0) var<storage, read> splats: array<SplatRecord>;
@group(1) @binding(1) var<storage, read> sortedIndices: array<u32>;
`;
}

function commonWGSL(pick: boolean): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) corner: vec2<f32>,
  @location(2) worldPos: vec3<f32>,
  @location(3) slot: f32,
};

fn quadCorner(vertexIndex: u32) -> vec2<f32> {
  switch (vertexIndex % 6u) {
    case 0u: { return vec2<f32>(-2.0, -2.0); }
    case 1u: { return vec2<f32>( 2.0, -2.0); }
    case 2u: { return vec2<f32>(-2.0,  2.0); }
    case 3u: { return vec2<f32>(-2.0,  2.0); }
    case 4u: { return vec2<f32>( 2.0, -2.0); }
    default: { return vec2<f32>( 2.0,  2.0); }
  }
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
  let splatIndex = sortedIndices[instanceIndex];
  let record = splats[splatIndex];
  let center = record.t0.xyz;
  let opacity = record.t0.w;
  let color = record.t1.rgb;
  let meshSlot = record.t1.w;
  let corner = quadCorner(vertexIndex);

  var output: VertexOutput;
  output.color = vec4<f32>(color, opacity);
  output.corner = corner;
  output.worldPos = center;
  output.slot = meshSlot;

  for (var i = 0u; i < 8u; i = i + 1u) {
    if (i >= u32(frame.sectionPlaneState.x)) {
      break;
    }
    let plane = frame.sectionPlanes[i];
    if (dot(plane.xyz, center) + plane.w > 0.0) {
      output.position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
      return output;
    }
  }

  let cam = frame.viewMatrix * vec4<f32>(center, 1.0);
  if (cam.z > -0.01) {
    output.position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
    return output;
  }

  let cov = mat3x3<f32>(
    vec3<f32>(record.t2.x, record.t2.y, record.t2.z),
    vec3<f32>(record.t2.y, record.t3.x, record.t3.y),
    vec3<f32>(record.t2.z, record.t3.y, record.t3.z)
  );
  let z = cam.z;
  let focal = frame.splatParams.zw;
  let viewport = max(frame.splatParams.xy, vec2<f32>(1.0, 1.0));
  let j = mat3x3<f32>(
    vec3<f32>(focal.x / z, 0.0, -(focal.x * cam.x) / (z * z)),
    vec3<f32>(0.0, focal.y / z, -(focal.y * cam.y) / (z * z)),
    vec3<f32>(0.0, 0.0, 0.0)
  );
  let w = transpose(mat3x3<f32>(frame.viewMatrix[0].xyz, frame.viewMatrix[1].xyz, frame.viewMatrix[2].xyz));
  let t = w * j;
  let cov2d = transpose(t) * cov * t;
  let a = cov2d[0][0] + 0.3;
  let b = cov2d[0][1];
  let c = cov2d[1][1] + 0.3;
  let mid = 0.5 * (a + c);
  let radius = length(vec2<f32>(0.5 * (a - c), b));
  let l1 = mid + radius;
  let l2 = mid - radius;
  if (l2 <= 0.0) {
    output.position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
    return output;
  }

  var e1 = vec2<f32>(1.0, 0.0);
  if (abs(b) + abs(l1 - a) > 0.000001) {
    e1 = normalize(vec2<f32>(b, l1 - a));
  }
  let e2 = vec2<f32>(e1.y, -e1.x);
  let major = min(sqrt(2.0 * l1), 1024.0) * e1;
  let minor = min(sqrt(2.0 * l2), 1024.0) * e2;
  let clip = frame.viewProjection * vec4<f32>(center, 1.0);
  let offset = (corner.x * major + corner.y * minor) / viewport * 2.0 * clip.w;
  output.position = vec4<f32>(clip.xy + offset, clip.zw);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let alpha = exp(-dot(input.corner, input.corner)) * input.color.a;
  if (alpha < ${pick ? "0.04" : "0.004"}) {
    discard;
  }
  ${pick ? `
  let encoded = u32(input.slot) + 1u;
  return vec4<f32>(
    f32(encoded & 255u) / 255.0,
    f32((encoded >> 8u) & 255u) / 255.0,
    f32((encoded >> 16u) & 255u) / 255.0,
    f32((encoded >> 24u) & 255u) / 255.0
  );
  ` : `
  return vec4<f32>(input.color.rgb * alpha, alpha);
  `}
}
`;
}

export function createSplatsDrawColorShader(): string {
  return `${frameUniformsWGSL()}${splatStorageWGSL()}${commonWGSL(false)}`;
}

export function createSplatsPickShader(): string {
  return `${frameUniformsWGSL()}${splatStorageWGSL()}${commonWGSL(true)}`;
}
