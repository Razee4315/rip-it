/** Tiny allocation-free math helpers. Matrices are column-major Float32Array(16). */

export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const smoothstep = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
};

/** Cheap deterministic hash → [0,1). */
export function hash01(n: number) {
	let x = (n | 0) * 374761393 + 668265263;
	x = (x ^ (x >>> 13)) * 1274126177;
	x ^= x >>> 16;
	return (x >>> 0) / 4294967296;
}

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function mat4(): Mat4 {
	const m = new Float32Array(16);
	m[0] = m[5] = m[10] = m[15] = 1;
	return m;
}

export function perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number) {
	const f = 1 / Math.tan(fovY / 2);
	out.fill(0);
	out[0] = f / aspect;
	out[5] = f;
	out[10] = (far + near) / (near - far);
	out[11] = -1;
	out[14] = (2 * far * near) / (near - far);
	return out;
}

export function ortho(out: Mat4, l: number, r: number, b: number, t: number, n: number, f: number) {
	out.fill(0);
	out[0] = 2 / (r - l);
	out[5] = 2 / (t - b);
	out[10] = -2 / (f - n);
	out[12] = -(r + l) / (r - l);
	out[13] = -(t + b) / (t - b);
	out[14] = -(f + n) / (f - n);
	out[15] = 1;
	return out;
}

export function lookAt(out: Mat4, eye: Vec3, at: Vec3, up: Vec3) {
	let zx = eye[0] - at[0],
		zy = eye[1] - at[1],
		zz = eye[2] - at[2];
	let l = Math.hypot(zx, zy, zz) || 1;
	zx /= l;
	zy /= l;
	zz /= l;
	let xx = up[1] * zz - up[2] * zy,
		xy = up[2] * zx - up[0] * zz,
		xz = up[0] * zy - up[1] * zx;
	l = Math.hypot(xx, xy, xz) || 1;
	xx /= l;
	xy /= l;
	xz /= l;
	const yx = zy * xz - zz * xy,
		yy = zz * xx - zx * xz,
		yz = zx * xy - zy * xx;
	out[0] = xx;
	out[1] = yx;
	out[2] = zx;
	out[3] = 0;
	out[4] = xy;
	out[5] = yy;
	out[6] = zy;
	out[7] = 0;
	out[8] = xz;
	out[9] = yz;
	out[10] = zz;
	out[11] = 0;
	out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
	out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
	out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
	out[15] = 1;
	return out;
}

export function mul(out: Mat4, a: Mat4, b: Mat4) {
	for (let c = 0; c < 4; c++) {
		const b0 = b[c * 4],
			b1 = b[c * 4 + 1],
			b2 = b[c * 4 + 2],
			b3 = b[c * 4 + 3];
		out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
		out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
		out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
		out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
	}
	return out;
}

export function invert(out: Mat4, m: Mat4) {
	const a00 = m[0],
		a01 = m[1],
		a02 = m[2],
		a03 = m[3],
		a10 = m[4],
		a11 = m[5],
		a12 = m[6],
		a13 = m[7],
		a20 = m[8],
		a21 = m[9],
		a22 = m[10],
		a23 = m[11],
		a30 = m[12],
		a31 = m[13],
		a32 = m[14],
		a33 = m[15];
	const b00 = a00 * a11 - a01 * a10,
		b01 = a00 * a12 - a02 * a10,
		b02 = a00 * a13 - a03 * a10,
		b03 = a01 * a12 - a02 * a11,
		b04 = a01 * a13 - a03 * a11,
		b05 = a02 * a13 - a03 * a12,
		b06 = a20 * a31 - a21 * a30,
		b07 = a20 * a32 - a22 * a30,
		b08 = a20 * a33 - a23 * a30,
		b09 = a21 * a32 - a22 * a31,
		b10 = a21 * a33 - a23 * a31,
		b11 = a22 * a33 - a23 * a32;
	let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	if (!det) return out;
	det = 1 / det;
	out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
	return out;
}

/** Compose translation · rotationY · rotationZ · scale into a model matrix. */
export function compose(
	out: Mat4,
	tx: number,
	ty: number,
	tz: number,
	sx: number,
	sy: number,
	sz: number,
	rotZ = 0,
	rotY = 0,
	rotX = 0,
) {
	const cz = Math.cos(rotZ),
		sn = Math.sin(rotZ);
	const cy = Math.cos(rotY),
		sny = Math.sin(rotY);
	const cx = Math.cos(rotX),
		snx = Math.sin(rotX);
	// R = Ry * Rx * Rz
	const r00 = cy * cz + sny * snx * sn,
		r01 = -cy * sn + sny * snx * cz,
		r02 = sny * cx;
	const r10 = cx * sn,
		r11 = cx * cz,
		r12 = -snx;
	const r20 = -sny * cz + cy * snx * sn,
		r21 = sny * sn + cy * snx * cz,
		r22 = cy * cx;
	out[0] = r00 * sx;
	out[1] = r10 * sx;
	out[2] = r20 * sx;
	out[3] = 0;
	out[4] = r01 * sy;
	out[5] = r11 * sy;
	out[6] = r21 * sy;
	out[7] = 0;
	out[8] = r02 * sz;
	out[9] = r12 * sz;
	out[10] = r22 * sz;
	out[11] = 0;
	out[12] = tx;
	out[13] = ty;
	out[14] = tz;
	out[15] = 1;
	return out;
}
