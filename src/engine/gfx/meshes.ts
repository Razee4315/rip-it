import type { GL } from "./gl";

export type Mesh = { vao: WebGLVertexArrayObject; count: number };

function upload(gl: GL, pos: number[], nrm: number[], idx: number[]): Mesh {
	const vao = gl.createVertexArray();
	if (!vao) throw new Error("createVertexArray failed");
	gl.bindVertexArray(vao);
	const data = new Float32Array((pos.length / 3) * 6);
	for (let i = 0, j = 0; i < pos.length; i += 3, j += 6) {
		data[j] = pos[i];
		data[j + 1] = pos[i + 1];
		data[j + 2] = pos[i + 2];
		data[j + 3] = nrm[i];
		data[j + 4] = nrm[i + 1];
		data[j + 5] = nrm[i + 2];
	}
	const vb = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vb);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
	const ib = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
	gl.bindVertexArray(null);
	return { vao, count: idx.length };
}

/** Unit cube centred on the origin. */
export function boxMesh(gl: GL): Mesh {
	const pos: number[] = [],
		nrm: number[] = [],
		idx: number[] = [];
	const faces: [number[], number[], number[]][] = [
		[
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		],
		[
			[-1, 0, 0],
			[0, 1, 0],
			[0, 0, -1],
		],
		[
			[0, 1, 0],
			[0, 0, 1],
			[1, 0, 0],
		],
		[
			[0, -1, 0],
			[0, 0, -1],
			[1, 0, 0],
		],
		[
			[0, 0, 1],
			[1, 0, 0],
			[0, 1, 0],
		],
		[
			[0, 0, -1],
			[-1, 0, 0],
			[0, 1, 0],
		],
	];
	for (const [n, u, v] of faces) {
		const b = pos.length / 3;
		for (const [su, sv] of [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1],
		]) {
			for (let k = 0; k < 3; k++) pos.push(0.5 * (n[k] + su * u[k] + sv * v[k]));
			nrm.push(n[0], n[1], n[2]);
		}
		idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
	}
	return upload(gl, pos, nrm, idx);
}

/** Radius 1, height 1 along Y, centred. `top` scales the upper radius (0 → cone). */
export function cylinderMesh(gl: GL, seg = 16, top = 1): Mesh {
	const pos: number[] = [],
		nrm: number[] = [],
		idx: number[] = [];
	const slope = 1 - top;
	for (let i = 0; i <= seg; i++) {
		const a = (i / seg) * Math.PI * 2;
		const c = Math.cos(a),
			s = Math.sin(a);
		const l = Math.hypot(1, slope);
		pos.push(c, -0.5, s, c * top, 0.5, s * top);
		nrm.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
	}
	for (let i = 0; i < seg; i++) {
		const a = i * 2;
		idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
	}
	// caps
	for (const y of [-0.5, 0.5]) {
		const r = y > 0 ? top : 1;
		if (r <= 0) continue;
		const c0 = pos.length / 3;
		pos.push(0, y, 0);
		nrm.push(0, Math.sign(y), 0);
		for (let i = 0; i <= seg; i++) {
			const a = (i / seg) * Math.PI * 2;
			pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
			nrm.push(0, Math.sign(y), 0);
		}
		for (let i = 0; i < seg; i++) {
			if (y > 0) idx.push(c0, c0 + i + 2, c0 + i + 1);
			else idx.push(c0, c0 + i + 1, c0 + i + 2);
		}
	}
	return upload(gl, pos, nrm, idx);
}

/** Unit sphere. */
export function sphereMesh(gl: GL, seg = 16, rings = 10): Mesh {
	const pos: number[] = [],
		nrm: number[] = [],
		idx: number[] = [];
	for (let j = 0; j <= rings; j++) {
		const t = (j / rings) * Math.PI;
		for (let i = 0; i <= seg; i++) {
			const a = (i / seg) * Math.PI * 2;
			const x = Math.sin(t) * Math.cos(a),
				y = Math.cos(t),
				z = Math.sin(t) * Math.sin(a);
			pos.push(x, y, z);
			nrm.push(x, y, z);
		}
	}
	for (let j = 0; j < rings; j++)
		for (let i = 0; i < seg; i++) {
			const a = j * (seg + 1) + i,
				b = a + seg + 1;
			idx.push(a, a + 1, b, a + 1, b + 1, b);
		}
	return upload(gl, pos, nrm, idx);
}

/** Torus in the XY plane: ring radius 1, tube radius `tube`. */
export function torusMesh(gl: GL, tube = 0.16, seg = 20, sides = 8): Mesh {
	const pos: number[] = [],
		nrm: number[] = [],
		idx: number[] = [];
	for (let i = 0; i <= seg; i++) {
		const a = (i / seg) * Math.PI * 2;
		const ca = Math.cos(a),
			sa = Math.sin(a);
		for (let j = 0; j <= sides; j++) {
			const b = (j / sides) * Math.PI * 2;
			const cb = Math.cos(b),
				sb = Math.sin(b);
			pos.push((1 + tube * cb) * ca, (1 + tube * cb) * sa, tube * sb);
			nrm.push(cb * ca, cb * sa, sb);
		}
	}
	for (let i = 0; i < seg; i++)
		for (let j = 0; j < sides; j++) {
			const a = i * (sides + 1) + j,
				b = a + sides + 1;
			idx.push(a, b, a + 1, a + 1, b, b + 1);
		}
	return upload(gl, pos, nrm, idx);
}
