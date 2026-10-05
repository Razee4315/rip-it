/**
 * WebGL2 renderer.
 *
 * Frame: shadow map → HDR scene (baked backdrop + shadows, props, cloth, particles)
 *        → bloom → tonemap/grade to the canvas.
 */
import type { Cloth } from "../cloth/Cloth";
import type { Fabric } from "../cloth/fabrics";
import { type Mat4, invert, lookAt, mat4, mul, ortho } from "../math";
import type { EnvDef } from "./environments";
import {
	FULLSCREEN_VS,
	type GL,
	type Program,
	type Target,
	freeTarget,
	hexToLinear,
	program,
	target,
	texture,
} from "./gl";
import { type Mesh, boxMesh, cylinderMesh, sphereMesh, torusMesh } from "./meshes";
import { INSTANCE_STRIDE, type Particles } from "./particles";
import { CLOTH_ATTRIBS, CLOTH_DEPTH_FS, CLOTH_DEPTH_VS, CLOTH_FS, CLOTH_VS } from "./shaders/cloth";
import { BACKDROP_FS, ENV_BAKE_FS } from "./shaders/env";
import {
	ART_FS,
	BRIGHT_FS,
	COMPOSITE_FS,
	DOWN_FS,
	EMPTY_FS,
	PARTICLE_FS,
	PARTICLE_VS,
	PROP_ATTRIBS,
	PROP_DEPTH_VS,
	PROP_FS,
	PROP_VS,
	UP_FS,
} from "./shaders/misc";
import { WEAVE_FS } from "./shaders/weave";

export type Quality = {
	/** fraction of device pixels to render */
	scale: number;
	/** cap on device pixel ratio */
	maxDpr: number;
	msaa: number;
	shadow: number;
	bloom: boolean;
};

export const QUALITY: Record<"low" | "medium" | "high", Quality> = {
	low: { scale: 0.75, maxDpr: 1, msaa: 0, shadow: 512, bloom: false },
	medium: { scale: 1, maxDpr: 1.5, msaa: 2, shadow: 1024, bloom: true },
	high: { scale: 1, maxDpr: 2, msaa: 4, shadow: 2048, bloom: true },
};

export type MeshKind = "box" | "cyl" | "cone" | "sphere" | "torus";

export type Prop = {
	mesh: MeshKind;
	model: Mat4;
	scale: [number, number, number];
	color: [number, number, number];
	rough: number;
	metal: number;
	/** 0 plain · 1 wood · 2 rope */
	kind: number;
	shadow?: boolean;
};

export type Frame = {
	time: number;
	shakeX: number;
	shakeY: number;
	fade: number;
	flash: number;
	flicker: number;
	fireX: number;
	fireY: number;
	fireZ: number;
	fireR: number;
	fireG: number;
	fireB: number;
	fireI: number;
};

export class Renderer {
	readonly gl: GL;
	readonly canvas: HTMLCanvasElement;
	quality: Quality;
	/** drawing-buffer size */
	w = 1;
	h = 1;

	private floatOK = false;
	private samples = 0;
	private aniso: EXT_texture_filter_anisotropic | null = null;

	private pCloth: Program;
	private pClothDepth: Program;
	private pProp: Program;
	private pPropDepth: Program;
	private pArt: Program;
	private pBake: Program;
	private pBackdrop: Program;
	private pParticle: Program;
	private pBright: Program;
	private pDown: Program;
	private pUp: Program;
	private pComposite: Program;

	private meshes: Record<MeshKind, Mesh>;
	private noiseTex: WebGLTexture;
	private weaveTex: WebGLTexture[] = [];
	private pWeave: Program | null = null;
	private printTex: WebGLTexture;
	private artTex: WebGLTexture | null = null;

	private scene: Target | null = null;
	private sceneDepth: WebGLRenderbuffer | null = null;
	private msaaFbo: WebGLFramebuffer | null = null;
	private msaaColor: WebGLRenderbuffer | null = null;
	private msaaDepth: WebGLRenderbuffer | null = null;
	private envTex: Target | null = null;
	private bloom: Target[] = [];
	private shadowFbo: WebGLFramebuffer | null = null;
	private shadowTex: WebGLTexture | null = null;
	private shadowSize = 0;

	// cloth
	private cloth: Cloth | null = null;
	private fabric: Fabric | null = null;
	private clothVao: WebGLVertexArrayObject | null = null;
	private bPos: WebGLBuffer | null = null;
	private bNrm: WebGLBuffer | null = null;
	private bUv: WebGLBuffer | null = null;
	private bAux: WebGLBuffer | null = null;
	private bIdx: WebGLBuffer | null = null;
	private auxData = new Uint8Array(0);
	private idxData = new Uint16Array(0);
	private idxCount = 0;
	private topoSeen = -1;
	private uvSeen = -1;
	private warpCol: [number, number, number] = [1, 1, 1];
	private weftCol: [number, number, number] = [1, 1, 1];

	// particles
	private partVao: WebGLVertexArrayObject;
	private bPart: WebGLBuffer;
	private partCap = 0;

	// scene state
	env: EnvDef | null = null;
	private stage: [number, number, number, number] = [0, 1, 1, 1];
	private seed = 0;
	props: Prop[] = [];
	art: { model: Mat4; scale: [number, number, number] } | null = null;
	private envDirty = true;

	readonly view = mat4();
	readonly proj = mat4();
	readonly vp = mat4();
	readonly invVp = mat4();
	readonly camPos: [number, number, number] = [0, 1, 3];
	private lightVP = mat4();
	private spotPos: [number, number, number] = [0, 0, 0];
	private spotAim: [number, number, number, number] = [0, -1, 0, 0];
	private lightDir: [number, number, number] = [0, 1, 0];

	lost = false;

	constructor(canvas: HTMLCanvasElement, quality: Quality) {
		this.canvas = canvas;
		this.quality = quality;
		const gl = canvas.getContext("webgl2", {
			antialias: false,
			alpha: false,
			depth: false,
			stencil: false,
			powerPreference: "high-performance",
			preserveDrawingBuffer: false,
		});
		if (!gl) throw new Error("WebGL2 is not available on this device");
		this.gl = gl;
		this.floatOK = !!gl.getExtension("EXT_color_buffer_float");
		this.aniso = gl.getExtension("EXT_texture_filter_anisotropic");

		this.pCloth = program(gl, "cloth", CLOTH_VS, CLOTH_FS, CLOTH_ATTRIBS);
		this.pClothDepth = program(gl, "clothDepth", CLOTH_DEPTH_VS, CLOTH_DEPTH_FS, CLOTH_ATTRIBS);
		this.pProp = program(gl, "prop", PROP_VS, PROP_FS, PROP_ATTRIBS);
		this.pPropDepth = program(gl, "propDepth", PROP_DEPTH_VS, EMPTY_FS, PROP_ATTRIBS);
		this.pArt = program(gl, "art", PROP_VS, ART_FS, PROP_ATTRIBS);
		this.pBake = program(gl, "envBake", FULLSCREEN_VS, ENV_BAKE_FS);
		this.pBackdrop = program(gl, "backdrop", FULLSCREEN_VS, BACKDROP_FS);
		this.pParticle = program(gl, "particles", PARTICLE_VS, PARTICLE_FS);
		this.pBright = program(gl, "bright", FULLSCREEN_VS, BRIGHT_FS);
		this.pDown = program(gl, "down", FULLSCREEN_VS, DOWN_FS);
		this.pUp = program(gl, "up", FULLSCREEN_VS, UP_FS);
		this.pComposite = program(gl, "composite", FULLSCREEN_VS, COMPOSITE_FS);

		this.meshes = {
			box: boxMesh(gl),
			cyl: cylinderMesh(gl, 18, 1),
			cone: cylinderMesh(gl, 14, 0),
			sphere: sphereMesh(gl),
			torus: torusMesh(gl),
		};
		this.noiseTex = this.makeNoise();
		// 1×1 white until a real print arrives
		this.printTex = texture(
			gl,
			1,
			1,
			gl.SRGB8_ALPHA8,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			gl.LINEAR,
			gl.CLAMP_TO_EDGE,
			new Uint8Array([255, 255, 255, 255]),
		);

		// particle quad + instance buffer
		const vao = gl.createVertexArray();
		const quad = gl.createBuffer();
		const inst = gl.createBuffer();
		if (!vao || !quad || !inst) throw new Error("particle buffers failed");
		this.partVao = vao;
		this.bPart = inst;
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, inst);
		for (let i = 0; i < 4; i++) {
			gl.enableVertexAttribArray(1 + i);
			gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, INSTANCE_STRIDE * 4, i * 16);
			gl.vertexAttribDivisor(1 + i, 1);
		}
		gl.bindVertexArray(null);

		canvas.addEventListener("webglcontextlost", (e) => {
			e.preventDefault();
			this.lost = true;
		});
		// When the OS hands the GPU back, every texture and buffer is gone. Progress is saved
		// as it is earned, so the simplest correct recovery is a clean restart.
		canvas.addEventListener("webglcontextrestored", () => window.location.reload());
	}

	// ════════════════════════════════════════════════════════════
	//  resources
	// ════════════════════════════════════════════════════════════

	/** Tiling RGBA noise: four independent fractal channels. */
	private makeNoise() {
		const gl = this.gl;
		const N = 256;
		const data = new Uint8Array(N * N * 4);
		const lattice = (per: number, seed: number) => {
			const g = new Float32Array(per * per);
			let s = seed * 9301 + 49297;
			for (let i = 0; i < g.length; i++) {
				s = (s * 1103515245 + 12345) & 0x7fffffff;
				g[i] = s / 0x7fffffff;
			}
			return g;
		};
		for (let c = 0; c < 4; c++) {
			const octs = [4, 8, 16, 32, 64].map((p, i) => ({ p, g: lattice(p, c * 7 + i + 1) }));
			for (let y = 0; y < N; y++)
				for (let x = 0; x < N; x++) {
					let v = 0,
						amp = 0.5,
						tot = 0;
					for (const { p, g } of octs) {
						const fx = (x / N) * p,
							fy = (y / N) * p;
						const x0 = Math.floor(fx),
							y0 = Math.floor(fy);
						let tx = fx - x0,
							ty = fy - y0;
						tx = tx * tx * (3 - 2 * tx);
						ty = ty * ty * (3 - 2 * ty);
						const x1 = (x0 + 1) % p,
							y1 = (y0 + 1) % p;
						const a = g[y0 * p + x0],
							b = g[y0 * p + x1],
							cc = g[y1 * p + x0],
							dd = g[y1 * p + x1];
						v += amp * (a + (b - a) * tx + (cc - a + (a - b - cc + dd) * tx) * ty);
						tot += amp;
						amp *= 0.55;
					}
					// stretch contrast so the texture uses the full range
					const n = Math.min(1, Math.max(0, (v / tot - 0.5) * 1.9 + 0.5));
					data[(y * N + x) * 4 + c] = Math.round(n * 255);
				}
		}
		const tex = texture(
			gl,
			N,
			N,
			gl.RGBA8,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			gl.LINEAR_MIPMAP_LINEAR,
			gl.REPEAT,
			data,
		);
		gl.generateMipmap(gl.TEXTURE_2D);
		return tex;
	}

	private makeWeave(kind: number) {
		if (this.weaveTex[kind]) return;
		const gl = this.gl;
		const p = this.pWeave ?? (this.pWeave = program(gl, "weave", FULLSCREEN_VS, WEAVE_FS));
		const N = 512;
		gl.useProgram(p.prog);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.viewport(0, 0, N, N);
		{
			const t = target(gl, N, N, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR_MIPMAP_LINEAR);
			gl.uniform1i(p.u.uKind, kind);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.bindTexture(gl.TEXTURE_2D, t.tex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.generateMipmap(gl.TEXTURE_2D);
			this.setAniso();
			gl.deleteFramebuffer(t.fbo);
			this.weaveTex[kind] = t.tex;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	private setAniso() {
		if (!this.aniso) return;
		const gl = this.gl;
		const max = gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
		gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
	}

	private uploadCanvas(cv: HTMLCanvasElement, old: WebGLTexture | null) {
		const gl = this.gl;
		if (old) gl.deleteTexture(old);
		const tex = gl.createTexture();
		if (!tex) throw new Error("createTexture failed");
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.generateMipmap(gl.TEXTURE_2D);
		this.setAniso();
		return tex;
	}

	/** Size the drawing buffer and every render target. Returns true if anything changed. */
	resize(cssW: number, cssH: number, dpr: number): boolean {
		const q = this.quality;
		const r = Math.min(dpr, q.maxDpr) * q.scale;
		const w = Math.max(2, Math.round(cssW * r)),
			h = Math.max(2, Math.round(cssH * r));
		if (w === this.w && h === this.h && this.scene) return false;
		this.w = w;
		this.h = h;
		this.canvas.width = w;
		this.canvas.height = h;
		this.makeTargets();
		this.envDirty = true;
		return true;
	}

	setQuality(q: Quality) {
		this.quality = q;
		// force the next resize() to rebuild every target at the new settings
		this.w = this.h = 0;
	}

	private makeTargets() {
		const gl = this.gl;
		const { w, h } = this;
		freeTarget(gl, this.scene);
		freeTarget(gl, this.envTex);
		for (const b of this.bloom) freeTarget(gl, b);
		this.bloom = [];
		if (this.sceneDepth) gl.deleteRenderbuffer(this.sceneDepth);
		if (this.msaaFbo) gl.deleteFramebuffer(this.msaaFbo);
		if (this.msaaColor) gl.deleteRenderbuffer(this.msaaColor);
		if (this.msaaDepth) gl.deleteRenderbuffer(this.msaaDepth);
		this.msaaFbo = this.msaaColor = this.msaaDepth = this.sceneDepth = null;

		let internal: number = this.floatOK ? gl.RGBA16F : gl.RGBA8;
		let type: number = this.floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
		this.scene = target(gl, w, h, internal, gl.RGBA, type);
		// some GPUs advertise float render targets and then refuse them: fall back to 8-bit
		if (this.floatOK && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
			freeTarget(gl, this.scene);
			this.floatOK = false;
			internal = gl.RGBA8;
			type = gl.UNSIGNED_BYTE;
			this.scene = target(gl, w, h, internal, gl.RGBA, type);
		}
		this.envTex = target(gl, w, h, internal, gl.RGBA, type, gl.NEAREST);

		// multisampling, when this GPU can do it for our colour format
		let samples = Math.min(this.quality.msaa, gl.getParameter(gl.MAX_SAMPLES) as number);
		if (samples > 1) {
			const ok = gl.getInternalformatParameter(
				gl.RENDERBUFFER,
				internal,
				gl.SAMPLES,
			) as Int32Array | null;
			const best = ok?.length ? Math.max(...Array.from(ok).filter((s) => s <= samples)) : 0;
			samples = best > 1 ? best : 0;
		}
		if (samples > 1) {
			this.msaaFbo = gl.createFramebuffer();
			this.msaaColor = gl.createRenderbuffer();
			this.msaaDepth = gl.createRenderbuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFbo);
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaColor);
			gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, internal, w, h);
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.COLOR_ATTACHMENT0,
				gl.RENDERBUFFER,
				this.msaaColor,
			);
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDepth);
			gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.RENDERBUFFER,
				this.msaaDepth,
			);
			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
				gl.deleteFramebuffer(this.msaaFbo);
				gl.deleteRenderbuffer(this.msaaColor);
				gl.deleteRenderbuffer(this.msaaDepth);
				this.msaaFbo = this.msaaColor = this.msaaDepth = null;
				samples = 0;
			}
		}
		this.samples = samples > 1 ? samples : 0;
		if (!this.msaaFbo) {
			this.sceneDepth = gl.createRenderbuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneDepth);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.RENDERBUFFER,
				this.sceneDepth,
			);
		}

		if (this.quality.bloom) {
			let bw = w >> 1,
				bh = h >> 1;
			for (let i = 0; i < 5 && bw > 8 && bh > 8; i++) {
				this.bloom.push(target(gl, bw, bh, internal, gl.RGBA, type));
				bw >>= 1;
				bh >>= 1;
			}
		}

		if (this.shadowSize !== this.quality.shadow) {
			if (this.shadowFbo) gl.deleteFramebuffer(this.shadowFbo);
			if (this.shadowTex) gl.deleteTexture(this.shadowTex);
			const s = this.quality.shadow;
			this.shadowSize = s;
			this.shadowTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.DEPTH_COMPONENT24,
				s,
				s,
				0,
				gl.DEPTH_COMPONENT,
				gl.UNSIGNED_INT,
				null,
			);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
			this.shadowFbo = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
			gl.framebufferTexture2D(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.TEXTURE_2D,
				this.shadowTex,
				0,
			);
			gl.drawBuffers([gl.NONE]);
			gl.readBuffer(gl.NONE);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	// ════════════════════════════════════════════════════════════
	//  scene setup
	// ════════════════════════════════════════════════════════════

	setEnvironment(
		env: EnvDef,
		stage: { cx: number; cy: number; hw: number; hh: number },
		seed: number,
	) {
		this.env = env;
		this.stage = [stage.cx, stage.cy, stage.hw, stage.hh];
		this.seed = seed;
		this.envDirty = true;
		// key light
		let dir = env.lightDir;
		if (env.spot) {
			const o = env.spot.offset;
			this.spotPos = [stage.cx + o[0] * stage.hw, stage.cy + o[1] * stage.hh, o[2]];
			const dx = stage.cx - this.spotPos[0],
				dy = stage.cy - this.spotPos[1],
				dz = -this.spotPos[2];
			const l = Math.hypot(dx, dy, dz);
			this.spotAim = [dx / l, dy / l, dz / l, Math.cos(env.spot.angle)];
			dir = [-dx / l, -dy / l, -dz / l];
		}
		this.lightDir = dir;
		// shadow frustum: an orthographic box around the play area, looking down the light
		const R = Math.hypot(stage.hw + 0.5, stage.hh + 0.7) + 0.3;
		const eye: [number, number, number] = [
			stage.cx + dir[0] * 7,
			stage.cy + dir[1] * 7,
			-0.2 + dir[2] * 7,
		];
		const lv = lookAt(mat4(), eye, [stage.cx, stage.cy, -0.2], [0, 1, 0]);
		const lp = ortho(mat4(), -R, R, -R, R, 1, 14);
		mul(this.lightVP, lp, lv);
	}

	setCamera(view: Mat4, proj: Mat4, pos: [number, number, number]) {
		this.view.set(view);
		this.proj.set(proj);
		mul(this.vp, proj, view);
		invert(this.invVp, this.vp);
		this.camPos[0] = pos[0];
		this.camPos[1] = pos[1];
		this.camPos[2] = pos[2];
		this.envDirty = true;
	}

	setCloth(cloth: Cloth | null, print: HTMLCanvasElement | null, dye?: string) {
		const gl = this.gl;
		this.cloth = cloth;
		if (cloth) this.makeWeave(cloth.fabric.look.weave);
		this.fabric = cloth ? cloth.fabric : null;
		if (cloth) {
			const lk = cloth.fabric.look;
			this.warpCol = hexToLinear(dye ?? lk.warp);
			// a dyed cloth keeps a slightly darker weft so the weave still reads
			const wf = hexToLinear(dye ?? lk.weft);
			this.weftCol = dye ? [wf[0] * 0.86, wf[1] * 0.86, wf[2] * 0.86] : wf;
		}
		this.topoSeen = -1;
		this.uvSeen = -1;
		if (print) this.printTex = this.uploadCanvas(print, this.printTex);
		if (!cloth) return;
		if (this.clothVao) {
			gl.deleteVertexArray(this.clothVao);
			for (const b of [this.bPos, this.bNrm, this.bUv, this.bAux, this.bIdx]) gl.deleteBuffer(b);
		}
		const mp = cloth.maxP;
		this.clothVao = gl.createVertexArray();
		gl.bindVertexArray(this.clothVao);
		const mk = (bytes: number, usage: number) => {
			const b = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, b);
			gl.bufferData(gl.ARRAY_BUFFER, bytes, usage);
			return b;
		};
		this.bPos = mk(mp * 12, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
		this.bNrm = mk(mp * 12, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
		this.bUv = mk(mp * 8, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
		this.bAux = mk(mp * 8, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(3);
		gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 8, 0);
		gl.enableVertexAttribArray(4);
		gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 8, 4);
		this.bIdx = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cloth.nt * 6, gl.DYNAMIC_DRAW);
		gl.bindVertexArray(null);
		this.auxData = new Uint8Array(mp * 8);
		this.idxData = new Uint16Array(cloth.nt * 3);
	}

	setArt(cv: HTMLCanvasElement | null, model?: Mat4, scale?: [number, number, number]) {
		if (!cv || !model || !scale) {
			this.art = null;
			return;
		}
		this.artTex = this.uploadCanvas(cv, this.artTex);
		this.art = { model, scale };
	}

	private updateCloth() {
		const gl = this.gl;
		const c = this.cloth;
		if (!c) return;
		const np = c.np;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, c.pos, 0, np * 3);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bNrm);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, c.nrm, 0, np * 3);
		if (this.uvSeen !== c.uvVersion) {
			this.uvSeen = c.uvVersion;
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bUv);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, c.uv, 0, np * 2);
		}
		const aux = this.auxData;
		const { burn, wet, fray, heat, seam } = c;
		for (let p = 0, o = 0; p < np; p++, o += 8) {
			aux[o] = burn[p] * 255;
			aux[o + 1] = wet[p] * 255;
			aux[o + 2] = fray[p] * 255;
			const ht = heat[p];
			aux[o + 3] = ht > 1 ? 255 : ht * 255;
			aux[o + 4] = seam[p] * 255;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bAux);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, aux, 0, np * 8);
		if (this.topoSeen !== c.topoVersion) {
			this.topoSeen = c.topoVersion;
			const idx = this.idxData;
			let n = 0;
			const { tri, triAlive } = c;
			for (let t = 0; t < c.nt; t++) {
				if (!triAlive[t]) continue;
				idx[n++] = tri[t * 3];
				idx[n++] = tri[t * 3 + 1];
				idx[n++] = tri[t * 3 + 2];
			}
			this.idxCount = n;
			gl.bindVertexArray(null);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx);
			gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idx, 0, n);
		}
	}

	// ════════════════════════════════════════════════════════════
	//  drawing
	// ════════════════════════════════════════════════════════════

	private setLights(p: Program, f: Frame) {
		const gl = this.gl;
		const e = this.env;
		if (!e) return;
		gl.uniform3fv(p.u.uCam, this.camPos);
		gl.uniform3fv(p.u.uLightDir, this.lightDir);
		gl.uniform3fv(p.u.uLightCol, e.lightCol);
		gl.uniform3fv(p.u.uSky, e.sky);
		gl.uniform3fv(p.u.uGround, e.ground);
		gl.uniform3fv(p.u.uRimDir, e.rimDir);
		gl.uniform3fv(p.u.uRimCol, e.rimCol);
		gl.uniform4f(p.u.uSpot, this.spotPos[0], this.spotPos[1], this.spotPos[2], e.spot ? 1 : 0);
		gl.uniform4fv(p.u.uSpotAim, this.spotAim);
		gl.uniform3f(p.u.uFirePos, f.fireX, f.fireY, f.fireZ);
		gl.uniform4f(p.u.uFireCol, f.fireR, f.fireG, f.fireB, f.fireI);
	}

	private bindTex(unit: number, tex: WebGLTexture | null, loc: WebGLUniformLocation | null) {
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1i(loc, unit);
	}

	private bakeEnv() {
		const gl = this.gl;
		const e = this.env;
		if (!e || !this.envTex) return;
		const p = this.pBake;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.envTex.fbo);
		gl.viewport(0, 0, this.w, this.h);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.useProgram(p.prog);
		this.setLights(p, ZERO_FRAME);
		gl.uniformMatrix4fv(p.u.uInvVP, false, this.invVp);
		gl.uniform1f(p.u.uWallZ, e.wallZ);
		gl.uniform1i(p.u.uEnv, e.index);
		gl.uniform4fv(p.u.uStage, this.stage);
		gl.uniform1f(p.u.uSeed, this.seed);
		gl.uniform1f(p.u.uEncode, this.floatOK ? 0 : 1);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		this.envDirty = false;
	}

	private drawProps(p: Program, depthOnly: boolean) {
		const gl = this.gl;
		for (const pr of this.props) {
			if (depthOnly && pr.shadow === false) continue;
			gl.uniformMatrix4fv(p.u.uModel, false, pr.model);
			if (!depthOnly) {
				gl.uniform3fv(p.u.uScale, pr.scale);
				gl.uniform3fv(p.u.uColor, pr.color);
				gl.uniform4f(p.u.uPm, pr.rough, pr.metal, pr.kind, 0);
			}
			const m = this.meshes[pr.mesh];
			gl.bindVertexArray(m.vao);
			gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
		}
	}

	private clothUniformsShared(p: Program) {
		const gl = this.gl;
		const c = this.cloth;
		const f = this.fabric;
		if (!c || !f) return;
		this.bindTex(1, this.weaveTex[f.look.weave], p.u.uWeave);
		this.bindTex(2, this.noiseTex, p.u.uNoise);
		gl.uniform2f(p.u.uSize, c.width, c.height);
		gl.uniform1f(p.u.uTile, f.look.tile);
		gl.uniform1f(p.u.uCutout, f.look.weave === 7 ? 1 : 0);
	}

	render(f: Frame, particles: Particles | null) {
		const gl = this.gl;
		const e = this.env;
		if (this.lost || !e || !this.scene || !this.envTex) return;
		if (this.envDirty) this.bakeEnv();
		this.updateCloth();
		const c = this.cloth;
		const fab = this.fabric;
		const haveCloth = !!c && !!fab && this.idxCount > 0;

		// ── 1. shadow map ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
		gl.viewport(0, 0, this.shadowSize, this.shadowSize);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.disable(gl.BLEND);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.POLYGON_OFFSET_FILL);
		gl.polygonOffset(2, 3);
		gl.disable(gl.CULL_FACE);
		if (haveCloth) {
			const p = this.pClothDepth;
			gl.useProgram(p.prog);
			gl.uniformMatrix4fv(p.u.uVP, false, this.lightVP);
			this.clothUniformsShared(p);
			gl.bindVertexArray(this.clothVao);
			gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);
		}
		if (this.props.length) {
			const p = this.pPropDepth;
			gl.useProgram(p.prog);
			gl.uniformMatrix4fv(p.u.uVP, false, this.lightVP);
			this.drawProps(p, true);
		}
		gl.disable(gl.POLYGON_OFFSET_FILL);

		// ── 2. scene ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFbo ?? this.scene.fbo);
		gl.viewport(0, 0, this.w, this.h);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		const texel = 1 / this.shadowSize;

		// backdrop
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		{
			const p = this.pBackdrop;
			gl.useProgram(p.prog);
			this.bindTex(0, this.envTex.tex, p.u.uEnvTex);
			this.bindTex(3, this.shadowTex, p.u.uShadow);
			gl.uniform1f(p.u.uShadowTexel, texel);
			gl.uniformMatrix4fv(p.u.uInvVP, false, this.invVp);
			gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
			gl.uniform3fv(p.u.uCam, this.camPos);
			gl.uniform1f(p.u.uWallZ, e.wallZ);
			gl.uniform3fv(p.u.uShadowTint, e.shadowTint);
			gl.uniform1f(p.u.uFlicker, f.flicker);
			gl.uniform1f(p.u.uEncode, this.floatOK ? 0 : 1);
			gl.uniform3f(p.u.uFirePos, f.fireX, f.fireY, f.fireZ);
			gl.uniform4f(p.u.uFireCol, f.fireR, f.fireG, f.fireB, f.fireI);
			gl.uniform1f(p.u.uFlash, f.flash);
			gl.bindVertexArray(null);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);

		// hidden artwork
		if (this.art && this.artTex) {
			const p = this.pArt;
			gl.useProgram(p.prog);
			this.setLights(p, f);
			gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
			gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
			gl.uniformMatrix4fv(p.u.uModel, false, this.art.model);
			gl.uniform3fv(p.u.uScale, this.art.scale);
			this.bindTex(0, this.artTex, p.u.uArt);
			this.bindTex(3, this.shadowTex, p.u.uShadow);
			gl.uniform1f(p.u.uShadowTexel, texel);
			gl.bindVertexArray(this.meshes.box.vao);
			gl.drawElements(gl.TRIANGLES, this.meshes.box.count, gl.UNSIGNED_SHORT, 0);
		}

		// props
		if (this.props.length) {
			const p = this.pProp;
			gl.useProgram(p.prog);
			this.setLights(p, f);
			gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
			gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
			this.bindTex(2, this.noiseTex, p.u.uNoise);
			this.bindTex(3, this.shadowTex, p.u.uShadow);
			gl.uniform1f(p.u.uShadowTexel, texel);
			gl.enable(gl.CULL_FACE);
			this.drawProps(p, false);
			gl.disable(gl.CULL_FACE);
		}

		// cloth
		if (haveCloth && c && fab) {
			const p = this.pCloth;
			const lk = fab.look;
			gl.useProgram(p.prog);
			this.setLights(p, f);
			gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
			gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
			this.bindTex(0, this.printTex, p.u.uPrint);
			this.clothUniformsShared(p);
			this.bindTex(3, this.shadowTex, p.u.uShadow);
			gl.uniform1f(p.u.uShadowTexel, texel);
			gl.uniform3fv(p.u.uWarp, this.warpCol);
			gl.uniform3fv(p.u.uWeft, this.weftCol);
			gl.uniform4f(p.u.uMat, lk.rough, lk.spec, lk.sheen, lk.aniso);
			gl.uniform4f(p.u.uMat2, lk.trans, lk.metal, lk.bump, lk.wrinkle);
			gl.uniform3fv(p.u.uSheenTint, hexToLinear(lk.sheenTint));
			gl.uniform3fv(p.u.uThread, hexToLinear(lk.thread));
			gl.uniform1f(p.u.uTime, f.time);
			const a2c = this.samples > 1;
			gl.uniform1f(p.u.uA2C, a2c ? 1 : 0);
			if (a2c) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
			gl.bindVertexArray(this.clothVao);
			gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);
			if (a2c) gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
		}

		// particles
		if (particles) {
			const n = particles.fill();
			if (n > 0) {
				const p = this.pParticle;
				gl.useProgram(p.prog);
				gl.uniformMatrix4fv(p.u.uView, false, this.view);
				gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
				this.bindTex(2, this.noiseTex, p.u.uNoise);
				gl.bindVertexArray(this.partVao);
				gl.bindBuffer(gl.ARRAY_BUFFER, this.bPart);
				if (this.partCap < particles.max) {
					gl.bufferData(gl.ARRAY_BUFFER, particles.out.byteLength, gl.DYNAMIC_DRAW);
					this.partCap = particles.max;
				}
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, particles.out, 0, n * INSTANCE_STRIDE);
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				gl.depthMask(false);
				gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
				gl.depthMask(true);
				gl.disable(gl.BLEND);
			}
		}

		// ── 3. resolve ──
		if (this.msaaFbo) {
			gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFbo);
			gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fbo);
			gl.blitFramebuffer(
				0,
				0,
				this.w,
				this.h,
				0,
				0,
				this.w,
				this.h,
				gl.COLOR_BUFFER_BIT,
				gl.NEAREST,
			);
		}

		// ── 4. bloom ──
		gl.disable(gl.DEPTH_TEST);
		gl.bindVertexArray(null);
		const bl = this.bloom;
		if (bl.length) {
			let src = this.scene;
			for (let i = 0; i < bl.length; i++) {
				const p = i === 0 ? this.pBright : this.pDown;
				gl.bindFramebuffer(gl.FRAMEBUFFER, bl[i].fbo);
				gl.viewport(0, 0, bl[i].w, bl[i].h);
				gl.useProgram(p.prog);
				this.bindTex(0, src.tex, p.u.uTex);
				gl.uniform2f(p.u.uTexel, 1 / src.w, 1 / src.h);
				if (i === 0) gl.uniform1f(p.u.uExposure, e.exposure);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				src = bl[i];
			}
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.useProgram(this.pUp.prog);
			for (let i = bl.length - 1; i > 0; i--) {
				gl.bindFramebuffer(gl.FRAMEBUFFER, bl[i - 1].fbo);
				gl.viewport(0, 0, bl[i - 1].w, bl[i - 1].h);
				this.bindTex(0, bl[i].tex, this.pUp.u.uTex);
				gl.uniform2f(this.pUp.u.uTexel, 1 / bl[i].w, 1 / bl[i].h);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
			gl.disable(gl.BLEND);
		}

		// ── 5. grade to screen ──
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.w, this.h);
		{
			const p = this.pComposite;
			gl.useProgram(p.prog);
			this.bindTex(0, this.scene.tex, p.u.uScene);
			this.bindTex(1, bl.length ? bl[0].tex : this.scene.tex, p.u.uBloom);
			gl.uniform1f(p.u.uHasBloom, bl.length ? 1 : 0);
			gl.uniform2f(p.u.uShake, f.shakeX, f.shakeY);
			gl.uniform4f(
				p.u.uGrade,
				e.exposure,
				e.bloom / Math.max(1, bl.length * 0.6),
				e.vignette,
				e.grain,
			);
			gl.uniform3fv(p.u.uTint, e.tint);
			gl.uniform1f(p.u.uFade, f.fade);
			gl.uniform1f(p.u.uTime, f.time);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
	}
}

const ZERO_FRAME: Frame = {
	time: 0,
	shakeX: 0,
	shakeY: 0,
	fade: 0,
	flash: 0,
	flicker: 1,
	fireX: 0,
	fireY: 0,
	fireZ: 0,
	fireR: 0,
	fireG: 0,
	fireB: 0,
	fireI: 0,
};
