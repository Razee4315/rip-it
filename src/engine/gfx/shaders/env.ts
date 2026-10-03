import { LIGHTS, NOISE, SHADOW } from "./common";

/** Ray through a pixel → where it lands on the floor (y = 0) or back wall (z = uWallZ). */
const RAY = `
uniform mat4 uInvVP;
uniform float uWallZ;
vec3 rayDir(vec2 uv) {
	vec4 a = uInvVP * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
	vec4 b = uInvVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
	return normalize(b.xyz / b.w - a.xyz / a.w);
}
vec3 landing(vec3 o, vec3 d, out bool isFloor) {
	float tf = d.y < -1e-4 ? -o.y / d.y : 1e9;
	float tw = d.z < -1e-4 ? (uWallZ - o.z) / d.z : 1e9;
	isFloor = tf < tw;
	return o + d * min(min(tf, tw), 200.0);
}
`;

/**
 * Bakes a level's surroundings — every world is painted procedurally, no image files.
 * rgb = lit colour (linear), a = how much of it comes from a flickering light
 * (or 1.0 where nothing can cast a shadow, i.e. open sky).
 */
export const ENV_BAKE_FS = `
${NOISE}
${LIGHTS}
${RAY}
in vec2 vUv;
uniform int uEnv;
uniform vec4 uStage;   // centre x, centre y, half width, half height of the play area
uniform float uSeed;
uniform float uEncode; // 1 → sqrt-encode for 8-bit targets
out vec4 oCol;
const float PI = 3.14159265;

struct Surf {
	vec3 albedo;
	vec3 N;
	float rough;
	float spec;
	vec3 emis;
	float ao;
	float keyK;
	float sky;
	vec3 glow;   // extra light that flickers
};

float corner(vec3 P, bool fl) {
	return fl ? P.z - uWallZ : P.y;
}

// ── 0: studio — a seamless photographer's sweep ─────────────────
void studio(vec3 P, bool fl, inout Surf s) {
	if (fl) {
		float c = fbm(P.xz * 2.5 + uSeed);
		float sp = vnoise(P.xz * 70.0);
		s.albedo = vec3(0.075, 0.074, 0.082) * (0.7 + 0.6 * c) + 0.008 * sp;
		s.rough = 0.3 + 0.3 * c;
		s.spec = 0.55;
	} else {
		float n = fbm(P.xy * 1.3 + uSeed);
		s.albedo = vec3(0.115, 0.108, 0.122) * (0.8 + 0.4 * n);
		s.albedo *= 0.95 + 0.1 * vnoise(vec2(P.x * 3.0, P.y * 46.0));
		s.rough = 0.95;
	}
	vec2 q = (P.xy - uStage.xy - vec2(0.0, uStage.w * 0.15)) / vec2(uStage.z * 1.7, uStage.w * 1.6);
	s.keyK = fl ? 0.9 : mix(0.12, 1.15, exp(-dot(q, q) * 1.1));
	s.ao = 0.4 + 0.6 * smoothstep(0.0, 0.9, corner(P, fl));
}

// ── 1: backyard — washing line, cedar fence, summer sky ─────────
float fenceTop(float x) {
	float w = 0.16;
	float id = floor(x / w);
	float f = fract(x / w) - 0.5;
	return 1.72 + 0.035 * (hash21(vec2(id, 3.0)) - 0.5) - abs(f) * 0.12;
}
void backyard(vec3 P, vec3 d, bool fl, inout Surf s) {
	if (fl) {
		float g1 = fbm(P.xz * 1.6 + uSeed);
		float g2 = fbm(P.xz * 9.0 + 4.0);
		float blades = vnoise(vec2(P.x * 110.0, P.z * 16.0));
		vec3 dark = vec3(0.022, 0.07, 0.01), light = vec3(0.105, 0.24, 0.028);
		s.albedo = mix(dark, light, clamp(g1 * 0.85 + g2 * 0.35 + blades * 0.3 - 0.15, 0.0, 1.0));
		s.albedo = mix(s.albedo, vec3(0.2, 0.22, 0.05), smoothstep(0.6, 0.8, fbm(P.xz * 0.7 + 9.0)) * 0.45);
		// dappled shade from a tree out of frame
		float dap = smoothstep(0.42, 0.62, fbm(P.xz * 1.1 + vec2(4.0, 1.0)));
		s.keyK = 0.45 + 0.55 * dap;
		s.rough = 1.0;
		s.ao = 0.5 + 0.5 * smoothstep(0.0, 0.7, corner(P, fl));
		return;
	}
	float top = fenceTop(P.x);
	if (P.y > top) {
		s.sky = 1.0;
		float h = clamp(d.y * 1.6 + 0.08, 0.0, 1.0);
		vec3 sky = mix(vec3(0.5, 0.7, 0.92), vec3(0.075, 0.26, 0.72), pow(h, 0.6));
		vec2 cp = P.xy * vec2(0.16, 0.42) + vec2(uSeed * 3.0, 0.0);
		float cl = smoothstep(0.48, 0.8, fbm(cp + 3.0));
		float clShade = fbm(cp * 2.0 + 7.0);
		sky = mix(sky, mix(vec3(0.62, 0.68, 0.8), vec3(1.0, 0.99, 0.96), clShade), cl * 0.9);
		// hedge and treetops beyond the fence
		float th = top + 0.18 + 0.85 * fbm(vec2(P.x * 0.8 + uSeed, 2.0)) + 0.2 * fbm(vec2(P.x * 6.0, 7.0));
		if (P.y < th) {
			float leaf = fbm(P.xy * 10.0);
			float lit = smoothstep(th - 0.7, th, P.y);
			sky = mix(vec3(0.008, 0.035, 0.008), vec3(0.06, 0.19, 0.03), leaf * (0.35 + 0.65 * lit));
			sky += vec3(0.12, 0.16, 0.03) * smoothstep(0.62, 0.8, leaf) * lit;
		}
		s.emis = sky;
		s.albedo = vec3(0.0);
		return;
	}
	float w = 0.16;
	float id = floor(P.x / w);
	float f = fract(P.x / w);
	float gap = smoothstep(0.0, 0.03, f) * smoothstep(1.0, 0.97, f);
	float grain = fbm(vec2(P.x * 60.0 + id * 13.0, P.y * 2.4 + id * 5.0));
	float knot = smoothstep(0.78, 0.92, fbm(vec2(P.x * 9.0 + id * 3.0, P.y * 5.0)));
	vec3 wood = mix(vec3(0.16, 0.08, 0.036), vec3(0.4, 0.23, 0.105), grain) * (0.75 + 0.5 * hash21(vec2(id, 1.0)));
	wood *= 1.0 - 0.55 * knot;
	// weathering: greyer toward the top where rain and sun get at it
	wood = mix(wood, vec3(dot(wood, vec3(0.33))) * 1.1, 0.35 * smoothstep(0.6, 1.7, P.y));
	s.albedo = wood * mix(0.1, 1.0, gap);
	s.N = normalize(vec3((f - 0.5) * (1.0 - gap) * 3.0 + (grain - 0.5) * 0.3, 0.0, 1.0));
	s.rough = 0.85;
	s.keyK = 0.55 + 0.45 * smoothstep(0.35, 0.6, fbm(P.xy * 0.9 + vec2(2.0, 5.0)));
	s.ao = 0.4 + 0.6 * smoothstep(0.0, 0.5, P.y);
}

// ── 2: theatre — boards, drapes, two follow-spots ───────────────
void theatre(vec3 P, bool fl, inout Surf s) {
	if (fl) {
		float w = 0.11;
		float id = floor(P.x / w);
		float f = fract(P.x / w);
		float len = 1.7;
		float off = hash21(vec2(id, 9.0)) * len;
		float seg = floor((P.z + off) / len);
		float fz = fract((P.z + off) / len);
		float seam = smoothstep(0.0, 0.035, f) * smoothstep(1.0, 0.965, f) * smoothstep(0.0, 0.006, fz) * smoothstep(1.0, 0.994, fz);
		float grain = fbm(vec2(P.x * 64.0 + id * 7.0, P.z * 3.0 + seg * 3.0));
		vec3 wood = mix(vec3(0.05, 0.02, 0.01), vec3(0.19, 0.09, 0.04), grain) * (0.7 + 0.6 * hash21(vec2(id, seg)));
		// scuffs where a thousand shoes have been
		wood *= 0.8 + 0.4 * fbm(P.xz * 3.0 + uSeed);
		s.albedo = wood * mix(0.2, 1.0, seam);
		s.rough = 0.22 + 0.3 * grain;
		s.spec = 1.0;
		s.ao = 0.4 + 0.6 * smoothstep(0.0, 0.9, corner(P, fl));
	} else {
		float fx = P.x * 6.5 + fbm(vec2(P.x * 1.4, P.y * 0.3) + uSeed) * 3.2;
		float fold = sin(fx);
		s.albedo = vec3(0.05, 0.011, 0.02) * (0.7 + 0.6 * fbm(P.xy * 3.0));
		s.N = normalize(vec3(cos(fx) * 1.1 + sin(fx * 2.3 + 1.0) * 0.4, 0.0, 1.0));
		s.ao = (0.3 + 0.7 * (fold * 0.5 + 0.5)) * (0.4 + 0.6 * smoothstep(0.0, 0.7, P.y));
		s.rough = 1.0;
		// gold fringe along the hem of the drape
		float hem = smoothstep(0.1, 0.085, P.y) * smoothstep(0.02, 0.035, P.y);
		s.albedo = mix(s.albedo, vec3(0.5, 0.3, 0.05) * (0.5 + 0.5 * step(0.5, fract(P.x * 60.0))), hem);
	}
}
float beam(vec2 p, vec2 o, vec2 t, float w0, float w1) {
	vec2 ab = t - o;
	float h = clamp(dot(p - o, ab) / dot(ab, ab), 0.0, 1.0);
	float dist = length(p - o - ab * h);
	float wd = mix(w0, w1, h);
	return exp(-dist * dist / (wd * wd)) * (1.0 - h * 0.55) * smoothstep(0.0, 0.08, h);
}

// ── 3: forge — brick, flagstones, a furnace out of frame ────────
void forge(vec3 P, bool fl, inout Surf s) {
	if (fl) {
		vec2 p = P.xz * 2.1 + 3.0;
		vec2 ip = floor(p), fp = fract(p);
		float d1 = 9.0, d2 = 9.0;
		vec2 cid = vec2(0.0);
		for (int j = -1; j <= 1; j++)
			for (int i = -1; i <= 1; i++) {
				vec2 g = vec2(float(i), float(j));
				vec2 o = hash22(ip + g);
				vec2 r = g + 0.2 + o * 0.6 - fp;
				float dd = dot(r, r);
				if (dd < d1) { d2 = d1; d1 = dd; cid = ip + g; } else if (dd < d2) { d2 = dd; }
			}
		float edge = smoothstep(0.015, 0.1, sqrt(d2) - sqrt(d1));
		float n = fbm(P.xz * 8.0);
		vec3 stone = mix(vec3(0.05, 0.046, 0.042), vec3(0.15, 0.135, 0.12), n) * (0.65 + 0.7 * hash21(cid));
		s.albedo = stone * mix(0.15, 1.0, edge);
		s.N = normalize(vec3((n - 0.5) * 0.25, 1.0, (fbm(P.xz * 8.0 + 5.0) - 0.5) * 0.25));
		s.rough = 0.6;
		s.spec = 0.35;
		s.ao = 0.4 + 0.6 * smoothstep(0.0, 0.8, corner(P, fl));
	} else {
		vec2 bs = vec2(0.24, 0.078);
		float row = floor(P.y / bs.y);
		float x = P.x + mod(row, 2.0) * bs.x * 0.5;
		vec2 id = vec2(floor(x / bs.x), row);
		vec2 f = vec2(fract(x / bs.x), fract(P.y / bs.y));
		float mx = smoothstep(0.0, 0.045, f.x) * smoothstep(1.0, 0.955, f.x);
		float my = smoothstep(0.0, 0.13, f.y) * smoothstep(1.0, 0.87, f.y);
		float brick = mx * my;
		float h = hash21(id);
		float n = fbm(vec2(x, P.y) * 34.0 + id * 3.0);
		vec3 bc = mix(vec3(0.17, 0.045, 0.024), vec3(0.4, 0.125, 0.06), h) * (0.65 + 0.6 * n);
		bc = mix(bc, vec3(0.07, 0.06, 0.055), step(0.9, hash21(id + 7.0)) * 0.75);
		vec3 mortar = vec3(0.16, 0.15, 0.135) * (0.6 + 0.5 * vnoise(P.xy * 90.0));
		s.albedo = mix(mortar * 0.55, bc, brick);
		s.N = normalize(vec3((f.x - 0.5) * (1.0 - mx) * 2.6 + (n - 0.5) * 0.4, (f.y - 0.5) * (1.0 - my) * 2.6, 1.0));
		float soot = smoothstep(0.5, 2.8, P.y + fbm(P.xy * 1.2 + uSeed) * 1.3);
		s.albedo *= mix(1.0, 0.22, soot);
		s.rough = 0.92;
		s.ao = 0.4 + 0.6 * smoothstep(0.0, 0.5, P.y);
	}
	// the furnace: warm light spilling in low from the left
	vec3 lp = vec3(uStage.x - uStage.z * 2.1, 0.45, uWallZ + 0.9);
	vec3 dl = lp - P;
	float d2l = dot(dl, dl);
	float nl = max(dot(s.N, dl * inversesqrt(d2l)), 0.0);
	s.glow = s.albedo * vec3(1.0, 0.36, 0.08) * 9.0 * nl / (1.0 + d2l * 1.6);
	s.keyK = 0.85;
}

// ── 4: dojo — shoji screens, tatami, lantern light ──────────────
void dojo(vec3 P, bool fl, inout Surf s) {
	if (fl) {
		float col = floor(P.x / 0.9);
		float zz = (P.z + mod(col, 2.0) * 0.9) / 1.8;
		vec2 id = vec2(col, floor(zz));
		vec2 f = vec2(fract(P.x / 0.9), fract(zz));
		float bx = min(f.x, 1.0 - f.x) * 0.9;
		float bz = min(f.y, 1.0 - f.y) * 1.8;
		float rush = vnoise(vec2(P.x * 5.0 + id.x * 3.0, P.z * 260.0));
		float rush2 = vnoise(vec2(P.x * 260.0, P.z * 3.0 + id.y));
		vec3 straw = mix(vec3(0.22, 0.2, 0.075), vec3(0.42, 0.39, 0.17), rush * 0.75 + rush2 * 0.25);
		straw *= 0.8 + 0.4 * hash21(id + 2.0);
		vec3 heri = vec3(0.012, 0.022, 0.03) * (0.7 + 0.6 * step(0.5, fract(P.z * 40.0)));
		float border = 1.0 - smoothstep(0.028, 0.032, bx);
		s.albedo = mix(straw, heri, border);
		s.albedo *= mix(0.3, 1.0, smoothstep(0.0, 0.004, min(bx, bz)));
		s.rough = 0.7;
		s.spec = 0.2;
		s.ao = 0.45 + 0.55 * smoothstep(0.0, 0.9, corner(P, fl));
		return;
	}
	float wains = 0.3;
	float kamoi = 2.02;
	vec3 woodD = mix(vec3(0.035, 0.018, 0.01), vec3(0.11, 0.058, 0.03), fbm(vec2(P.x * 4.0, P.y * 70.0)));
	if (P.y < wains || P.y > kamoi) {
		s.albedo = woodD * (P.y > kamoi ? 0.8 : 1.0);
		s.rough = 0.5;
		s.ao = 0.5 + 0.5 * smoothstep(0.0, 0.25, P.y);
		return;
	}
	// posts every 0.9 m, fine lattice between
	float px = abs(fract(P.x / 0.9 + 0.5) - 0.5) * 0.9;
	float post = 1.0 - smoothstep(0.028, 0.031, px);
	float kx = abs(fract(P.x / 0.225 + 0.5) - 0.5) * 0.225;
	float ky = abs(fract((P.y - wains) / 0.29 + 0.5) - 0.5) * 0.29;
	float lat = 1.0 - smoothstep(0.006, 0.008, min(kx, ky));
	float rail = 1.0 - smoothstep(0.02, 0.023, min(P.y - wains, kamoi - P.y));
	float wood = max(max(post, lat), rail);
	// washi: lit from behind, with the garden's shadows playing on it
	float fib = fbm(P.xy * vec2(40.0, 14.0)) * 0.5 + fbm(P.xy * 90.0) * 0.5;
	float leafA = smoothstep(0.5, 0.62, fbm(P.xy * 1.7 + vec2(uSeed * 5.0, 1.0)));
	float leafB = smoothstep(0.45, 0.7, fbm(P.xy * 6.0 + 3.0));
	float branch = smoothstep(0.035, 0.0, abs(P.y - 1.25 - 0.22 * sin(P.x * 1.3 + 1.0) - 0.1 * fbm(vec2(P.x * 3.0, 0.0))));
	float shade = clamp(leafA * leafB * 0.75 + branch * 0.5 * leafA, 0.0, 1.0);
	float fall = 0.55 + 0.45 * smoothstep(wains, kamoi, P.y);
	vec3 paper = vec3(1.0, 0.8, 0.52) * (0.62 + 0.14 * fib) * fall * (1.0 - 0.5 * shade);
	// each pane is a touch dimmer near its frame
	paper *= 0.82 + 0.18 * smoothstep(0.0, 0.035, min(kx, ky));
	s.emis = paper * 1.9 * (1.0 - wood);
	s.albedo = mix(vec3(0.5, 0.45, 0.36), woodD, wood);
	s.rough = mix(0.95, 0.5, wood);
	s.keyK = 0.6;
	s.ao = 1.0;
}

void main() {
	vec3 d = rayDir(vUv);
	bool fl;
	vec3 P = landing(uCam, d, fl);
	Surf s;
	s.albedo = vec3(0.1);
	s.N = fl ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
	s.rough = 0.9;
	s.spec = 0.0;
	s.emis = vec3(0.0);
	s.ao = 1.0;
	s.keyK = 1.0;
	s.sky = 0.0;
	s.glow = vec3(0.0);
	if (uEnv == 0) studio(P, fl, s);
	else if (uEnv == 1) backyard(P, d, fl, s);
	else if (uEnv == 2) theatre(P, fl, s);
	else if (uEnv == 3) forge(P, fl, s);
	else dojo(P, fl, s);

	float cone;
	vec3 L = keyDir(P, cone);
	float ndl = max(dot(s.N, L), 0.0);
	vec3 hemi = mix(uGround, uSky, s.N.y * 0.5 + 0.5);
	vec3 col = s.albedo * (uLightCol * ndl * cone * s.keyK + hemi * s.ao);
	if (s.spec > 0.0) {
		vec3 V = normalize(uCam - P);
		vec3 H = normalize(L + V);
		float ndh = max(dot(s.N, H), 0.0);
		float a = max(s.rough * s.rough, 0.03);
		float a2 = a * a;
		float dd = ndh * ndh * (a2 - 1.0) + 1.0;
		col += uLightCol * (a2 / (PI * dd * dd)) * 0.02 * s.spec * cone * s.keyK;
		// polished floors pick up a soft mirror of the lit wall behind them
		float fres = 0.04 + 0.96 * pow(1.0 - max(dot(s.N, V), 0.0), 5.0);
		col += hemi * fres * s.spec * 0.6;
	}
	col += s.emis;
	if (uEnv == 2) {
		// haze in the spotlights
		vec2 c = uStage.xy;
		float b1 = beam(P.xy, c + vec2(-uStage.z * 2.4, uStage.w * 2.6), c + vec2(uStage.z * 0.2, -uStage.w * 0.9), 0.1, uStage.z * 0.95);
		float b2 = beam(P.xy, c + vec2(uStage.z * 2.6, uStage.w * 2.5), c + vec2(-uStage.z * 0.3, -uStage.w * 0.8), 0.1, uStage.z * 0.8);
		col += (vec3(1.0, 0.82, 0.55) * b1 + vec3(0.55, 0.7, 1.0) * b2 * 0.6) * 0.035 * (fl ? 0.4 : 1.0);
	}
	col += s.glow;
	// distance haze toward the horizon line keeps the floor from looking endless
	float gl = dot(s.glow, vec3(0.33));
	float tl = dot(col, vec3(0.33)) + 1e-4;
	float a = s.sky > 0.5 ? 1.0 : clamp(gl / tl, 0.0, 1.0) * 0.9;
	if (uEncode > 0.5) col = sqrt(clamp(col, 0.0, 4.0) * 0.25);
	oCol = vec4(col, a);
}
`;

/** Per-frame backdrop: the baked surroundings plus everything that moves — shadows and firelight. */
export const BACKDROP_FS = `
${SHADOW}
${RAY}
in vec2 vUv;
uniform sampler2D uEnvTex;
uniform mat4 uLightVP;
uniform vec3 uCam;
uniform vec3 uShadowTint;
uniform float uFlicker;
uniform float uEncode;
uniform vec3 uFirePos;
uniform vec4 uFireCol;
uniform float uFlash;
out vec4 oCol;
void main() {
	vec4 e = texture(uEnvTex, vUv);
	vec3 col = e.rgb;
	if (uEncode > 0.5) col = col * col * 4.0;
	if (e.a < 0.95) {
		bool fl;
		vec3 P = landing(uCam, rayDir(vUv), fl);
		vec4 sc = uLightVP * vec4(P, 1.0);
		// wide, soft penumbra: the cloth hangs well clear of the wall
		float s = shadowAt(sc, fl ? 2.2 : 3.6, 0.003);
		float s2 = shadowAt(sc, fl ? 5.0 : 8.0, 0.003);
		s = mix(s, s2, 0.5);
		col *= mix(uShadowTint, vec3(1.0), s);
		col *= 1.0 + (uFlicker - 1.0) * e.a / 0.9;
		if (uFireCol.a > 0.0) {
			vec3 d = uFirePos - P;
			float d2 = dot(d, d);
			col += (col + 0.01) * uFireCol.rgb * uFireCol.a * 2.5 / (1.0 + d2 * 3.0);
		}
	}
	col *= 1.0 + uFlash;
	oCol = vec4(col, 1.0);
}
`;
