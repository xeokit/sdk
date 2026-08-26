export type Mat3Tuple = [number, number, number, number, number, number, number, number, number];
export type QuatTuple = [number, number, number, number];
export type Vec3Tuple = [number, number, number];
export type Quat = ArrayLike<number>;
export type Vec3 = ArrayLike<number>;

export const EPSILON = 1e-9;

export function vec3(x = 0, y = 0, z = 0): Vec3Tuple {
  return [x, y, z];
}

export function cloneVec3(v: Vec3): Vec3Tuple {
  return [Number(v[0] || 0), Number(v[1] || 0), Number(v[2] || 0)];
}

export function addVec3(a: Vec3, b: Vec3): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subVec3(a: Vec3, b: Vec3): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function mulVec3Scalar(v: Vec3, s: number): Vec3Tuple {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossVec3(a: Vec3, b: Vec3): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function lenVec3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalizeVec3(v: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3Tuple {
  const len = lenVec3(v);
  if (len <= EPSILON) {
    return cloneVec3(fallback);
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function mat3MulVec3(m: Mat3Tuple, v: Vec3): Vec3Tuple {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

export function invertMat3(m: Mat3Tuple): Mat3Tuple {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[3], a11 = m[4], a12 = m[5];
  const a20 = m[6], a21 = m[7], a22 = m[8];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) <= EPSILON) {
    throw new Error("Cannot invert singular Mat3");
  }
  const invDet = 1 / det;
  return [
    b01 * invDet,
    (-a22 * a01 + a02 * a21) * invDet,
    (a12 * a01 - a02 * a11) * invDet,
    b11 * invDet,
    (a22 * a00 - a02 * a20) * invDet,
    (-a12 * a00 + a02 * a10) * invDet,
    b21 * invDet,
    (-a21 * a00 + a01 * a20) * invDet,
    (a11 * a00 - a01 * a10) * invDet
  ];
}

export function normalizeQuat(q: Quat): QuatTuple {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len <= EPSILON) {
    return [0, 0, 0, 1];
  }
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function conjugateQuat(q: Quat): QuatTuple {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function mulQuat(a: Quat, b: Quat): QuatTuple {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

export function rotateVec3ByQuat(q: Quat, v: Vec3): Vec3Tuple {
  const x = v[0], y = v[1], z = v[2];
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
}

export function rotateWorldToBody(qBodyToWorld: Quat, vWorld: Vec3): Vec3Tuple {
  return rotateVec3ByQuat(conjugateQuat(qBodyToWorld), vWorld);
}

export function integrateBodyToWorldQuat(q: Quat, angularVelocityBody: Vec3, dt: number): QuatTuple {
  const omega: QuatTuple = [angularVelocityBody[0], -angularVelocityBody[1], angularVelocityBody[2], 0];
  const qDot = mulQuat(q, omega);
  return normalizeQuat([
    q[0] + 0.5 * qDot[0] * dt,
    q[1] + 0.5 * qDot[1] * dt,
    q[2] + 0.5 * qDot[2] * dt,
    q[3] + 0.5 * qDot[3] * dt
  ]);
}

export function slerpQuat(a: Quat, b: Quat, t: number): QuatTuple {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) {
    return normalizeQuat([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t
    ]);
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    a[0] * wa + bx * wb,
    a[1] * wa + by * wb,
    a[2] * wa + bz * wb,
    a[3] * wa + bw * wb
  ];
}

export function quatFromBodyAxes(forwardWorld: Vec3, rightWorld: Vec3, downWorld: Vec3): QuatTuple {
  const m00 = forwardWorld[0], m01 = rightWorld[0], m02 = downWorld[0];
  const m10 = forwardWorld[1], m11 = rightWorld[1], m12 = downWorld[1];
  const m20 = forwardWorld[2], m21 = rightWorld[2], m22 = downWorld[2];
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return normalizeQuat([x, y, z, w]);
}
