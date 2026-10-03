import { NOISE } from "./common";

/**
 * Bakes one tiling weave into an RGBA texture:
 *   rg = tangent-space normal, b = thread height (for occlusion between threads),
 *   a  = "warp thread is on top" mask — or, for ring mail, coverage (it has holes).
 */
export const WEAVE_FS = `
${NOISE}
in vec2 vUv;
uniform int uKind;
layout(location = 0) out vec4 oA;
const float PI = 3.14159265;

float prof(float f, float w) {
	float x = f / w;
	return sqrt(max(0.0, 1.0 - x * x));
}

// returns height in x, warp mask in y, coverage in z
vec3 weave(vec2 uv) {
	if (uKind == 0) {
		// plain weave: every thread goes over one, under one
		float n = 8.0;
		vec2 p = uv * n;
		vec2 c = floor(p);
		vec2 f = fract(p) - 0.5;
		float ew = cos(PI * (p.y - 0.5) + PI * c.x);
		float ef = -cos(PI * (p.x - 0.5) + PI * c.y);
		float slubW = 0.82 + 0.3 * tnoise(vec2(c.x * 3.1, p.y * 0.9), n);
		float slubF = 0.82 + 0.3 * tnoise(vec2(p.x * 0.9, c.y * 3.1 + 40.0), n);
		float hw = prof(f.x, 0.47 * slubW) * (0.62 + 0.38 * ew);
		float hf = prof(f.y, 0.47 * slubF) * (0.62 + 0.38 * ef);
		// fibres twisting along each thread
		hw *= 0.9 + 0.1 * sin((p.y + f.x * 1.6) * 34.0);
		hf *= 0.9 + 0.1 * sin((p.x + f.y * 1.6) * 34.0);
		return vec3(max(hw, hf), step(hf, hw), 1.0);
	}
	if (uKind == 1) {
		// 2/1 twill: warp floats over two, under one, stepping sideways → diagonal ribs
		float n = 12.0;
		vec2 p = uv * n;
		vec2 c = floor(p);
		vec2 f = fract(p) - 0.5;
		float top = step(0.5, mod(c.y - c.x + 300.0, 3.0));
		float topUp = step(0.5, mod(c.y - 1.0 - c.x + 300.0, 3.0));
		float topDn = step(0.5, mod(c.y + 1.0 - c.x + 300.0, 3.0));
		// warp height eases between neighbouring cells so floats read as long humps
		float along = f.y + 0.5;
		float ew = mix(mix(topUp, top, smoothstep(0.0, 0.5, along)), mix(top, topDn, smoothstep(0.5, 1.0, along)), step(0.5, along));
		float hw = prof(f.x, 0.48) * (0.35 + 0.65 * ew);
		float hf = prof(f.y, 0.46) * (0.9 - 0.55 * top);
		hw *= 0.9 + 0.1 * sin((p.y + f.x) * 40.0);
		return vec3(max(hw, hf), step(hf, hw), 1.0);
	}
	if (uKind == 2) {
		// satin: long warp floats, almost no interlacing visible → smooth, lustrous
		float n = 20.0;
		vec2 p = uv * n;
		vec2 c = floor(p);
		vec2 f = fract(p) - 0.5;
		float bind = 1.0 - step(0.5, mod(2.0 * c.x + c.y + 500.0, 5.0));
		float hw = prof(f.x, 0.5) * (1.0 - 0.5 * bind * prof(f.y, 0.5));
		float hf = prof(f.y, 0.4) * 0.55 * bind;
		return vec3(max(hw, hf) * 0.6 + 0.4, step(hf, hw), 1.0);
	}
	if (uKind == 3) {
		// velvet: no weave to see, just a dense random pile
		float h = tnoise(uv * 64.0, 64.0) * 0.5 + tnoise(uv * 128.0 + 9.0, 128.0) * 0.35 + tnoise(uv * 16.0 + 3.0, 16.0) * 0.15;
		return vec3(h, 1.0, 1.0);
	}
	if (uKind == 4) {
		// leather: pebbled grain — cells with creases between them, plus fine pores
		float n = 14.0;
		vec2 p = uv * n;
		vec2 ip = floor(p), fp = fract(p);
		float d1 = 9.0, d2 = 9.0;
		for (int j = -1; j <= 1; j++)
			for (int i = -1; i <= 1; i++) {
				vec2 g = vec2(float(i), float(j));
				vec2 o = hash22(mod(ip + g, n));
				vec2 r = g + 0.15 + o * 0.7 - fp;
				float d = dot(r, r);
				if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
			}
		float crease = smoothstep(0.0, 0.32, sqrt(d2) - sqrt(d1));
		float pores = tnoise(uv * 90.0, 90.0);
		return vec3(crease * 0.85 + pores * 0.15, 1.0, 1.0);
	}
	if (uKind == 5) {
		// latex: glassy smooth, the faintest orange-peel
		return vec3(0.5 + 0.08 * tnoise(uv * 24.0, 24.0), 1.0, 1.0);
	}
	if (uKind == 6) {
		// paper: matted fibres lying every which way
		float h = 0.0;
		h += tnoise(vec2(uv.x * 96.0, uv.y * 12.0), 12.0) * 0.3;
		h += tnoise(vec2(uv.x * 14.0 + 5.0, uv.y * 110.0), 14.0) * 0.3;
		h += tnoise((uv.xy + uv.yx * vec2(1.0, -1.0)) * 40.0, 40.0) * 0.25;
		h += tnoise(uv * 180.0, 180.0) * 0.15;
		return vec3(h, 1.0, 1.0);
	}
	// chainmail: rows of overlapping steel rings, alternate rows leaning opposite ways
	float n = 6.0;
	vec2 p = uv * vec2(n, n * 2.0);
	float best = 0.0;
	float cov = 0.0;
	float lean = 0.0;
	for (int j = -1; j <= 1; j++)
		for (int i = -1; i <= 1; i++) {
			vec2 cell = floor(p) + vec2(float(i), float(j));
			float odd = mod(cell.y, 2.0);
			vec2 ctr = cell + vec2(0.5 + 0.5 * odd, 0.5);
			vec2 d = p - ctr;
			d.y *= 0.62;
			float r = length(d);
			float a = abs(r - 0.56);
			float tube = 0.135;
			if (a < tube) {
				float tilt = (odd * 2.0 - 1.0) * d.x * 0.9;
				float h = sqrt(1.0 - (a / tube) * (a / tube)) * 0.6 + 0.4 + tilt;
				if (h > best) { best = h; lean = odd; }
				cov = 1.0;
			}
		}
	return vec3(best, lean, cov);
}

void main() {
	float e = 1.0 / 512.0;
	vec3 w = weave(vUv);
	float hx = weave(vUv + vec2(e, 0.0)).x - weave(vUv - vec2(e, 0.0)).x;
	float hy = weave(vUv + vec2(0.0, e)).x - weave(vUv - vec2(0.0, e)).x;
	vec2 n = clamp(vec2(-hx, -hy) * 6.0, -1.0, 1.0);
	// a carries the warp mask for woven cloth, or coverage for ring mail (which has holes)
	oA = vec4(n * 0.5 + 0.5, clamp(w.x, 0.0, 1.0), uKind == 7 ? w.z : w.y);
}
`;
