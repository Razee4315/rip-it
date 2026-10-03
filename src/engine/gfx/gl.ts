/** Thin WebGL2 helpers — just enough to keep the renderer readable. */

export type GL = WebGL2RenderingContext;

export type Program = {
	prog: WebGLProgram;
	u: Record<string, WebGLUniformLocation | null>;
};

function compile(gl: GL, type: number, src: string, label: string) {
	const sh = gl.createShader(type);
	if (!sh) throw new Error("createShader failed");
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(sh) || "";
		const lines = src
			.split("\n")
			.map((l, i) => `${String(i + 1).padStart(3)}: ${l}`)
			.join("\n");
		console.error(`[gfx] ${label} failed to compile:\n${log}\n${lines}`);
		throw new Error(`Shader compile failed (${label}): ${log}`);
	}
	return sh;
}

const HEAD = "#version 300 es\nprecision highp float;\nprecision highp int;\n";

/**
 * Link a program. `attribs` pins attribute names to locations so several programs
 * (e.g. colour and shadow passes) can share one vertex array.
 */
export function program(
	gl: GL,
	label: string,
	vs: string,
	fs: string,
	attribs: string[] = [],
	defines = "",
): Program {
	const prog = gl.createProgram();
	if (!prog) throw new Error("createProgram failed");
	const v = compile(gl, gl.VERTEX_SHADER, HEAD + defines + vs, `${label}.vert`);
	const f = compile(gl, gl.FRAGMENT_SHADER, HEAD + defines + fs, `${label}.frag`);
	gl.attachShader(prog, v);
	gl.attachShader(prog, f);
	attribs.forEach((name, i) => gl.bindAttribLocation(prog, i, name));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(prog) || "";
		console.error(`[gfx] ${label} failed to link: ${log}`);
		throw new Error(`Program link failed (${label}): ${log}`);
	}
	gl.deleteShader(v);
	gl.deleteShader(f);
	const u: Record<string, WebGLUniformLocation | null> = {};
	const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
	for (let i = 0; i < n; i++) {
		const info = gl.getActiveUniform(prog, i);
		if (!info) continue;
		const name = info.name.replace(/\[0\]$/, "");
		u[name] = gl.getUniformLocation(prog, name);
	}
	return { prog, u };
}

export type Target = {
	fbo: WebGLFramebuffer;
	tex: WebGLTexture;
	w: number;
	h: number;
};

export function texture(
	gl: GL,
	w: number,
	h: number,
	internal: number,
	format: number,
	type: number,
	filter: number,
	wrap: number,
	data: ArrayBufferView | null = null,
) {
	const tex = gl.createTexture();
	if (!tex) throw new Error("createTexture failed");
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(
		gl.TEXTURE_2D,
		gl.TEXTURE_MAG_FILTER,
		filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR,
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
	return tex;
}

/** Colour render target backed by a texture. */
export function target(
	gl: GL,
	w: number,
	h: number,
	internal: number,
	format: number,
	type: number,
	filter: number = gl.LINEAR,
): Target {
	const tex = texture(gl, w, h, internal, format, type, filter, gl.CLAMP_TO_EDGE);
	const fbo = gl.createFramebuffer();
	if (!fbo) throw new Error("createFramebuffer failed");
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	return { fbo, tex, w, h };
}

export function freeTarget(gl: GL, t: Target | null) {
	if (!t) return;
	gl.deleteFramebuffer(t.fbo);
	gl.deleteTexture(t.tex);
}

/** One oversized triangle covering the screen; the vertex shader derives it from gl_VertexID. */
export const FULLSCREEN_VS = `
out vec2 vUv;
void main() {
	vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
	vUv = p;
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function hexToLinear(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	return c.map((v) => (v / 255) ** 2.2) as [number, number, number];
}
