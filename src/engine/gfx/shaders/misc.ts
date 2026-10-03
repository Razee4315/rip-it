import { LIGHTS, SHADOW } from "./common";

// ── props: rods, pegs, rings, frames ────────────────────────────
export const PROP_ATTRIBS = ["aPos", "aNrm"];

export const PROP_VS = `
in vec3 aPos;
in vec3 aNrm;
uniform mat4 uVP;
uniform mat4 uModel;
uniform mat4 uLightVP;
uniform vec3 uScale;
out vec3 vPos;
out vec3 vNrm;
out vec3 vObj;
out vec4 vShadow;
void main() {
	vec4 w = uModel * vec4(aPos, 1.0);
	vPos = w.xyz;
	vNrm = normalize(mat3(uModel) * (aNrm / (uScale * uScale)));
	vObj = aPos * uScale;
	vShadow = uLightVP * vec4(w.xyz + vNrm * 0.004, 1.0);
	gl_Position = uVP * w;
}`;

export const PROP_FS = `
${LIGHTS}
${SHADOW}
in vec3 vPos;
in vec3 vNrm;
in vec3 vObj;
in vec4 vShadow;
uniform sampler2D uNoise;
uniform vec3 uColor;
uniform vec4 uPm;   // rough, metal, kind (0 plain · 1 wood · 2 rope · 3 emissive art), unused
out vec4 oCol;
const float PI = 3.14159265;
void main() {
	vec3 N = normalize(vNrm);
	vec3 V = normalize(uCam - vPos);
	vec3 albedo = uColor;
	float rough = uPm.x;
	if (uPm.z > 0.5 && uPm.z < 1.5) {
		// wood: grain runs along the longest axis
		vec3 o = vObj;
		vec2 g = abs(o.x) > abs(o.y) ? vec2(o.x * 0.7, (o.y + o.z) * 9.0) : vec2(o.y * 0.7, (o.x + o.z) * 9.0);
		float n = texture(uNoise, g).r * 0.6 + texture(uNoise, g * vec2(3.0, 5.0)).g * 0.4;
		albedo *= 0.6 + 0.8 * n;
		rough = clamp(rough + (n - 0.5) * 0.3, 0.05, 1.0);
	} else if (uPm.z > 1.5 && uPm.z < 2.5) {
		// rope: twisted strands
		float tw = sin(vObj.y * 260.0 + atan(vObj.z, vObj.x) * 3.0);
		albedo *= 0.7 + 0.3 * tw;
		N = normalize(N + vec3(0.0, tw * 0.25, 0.0));
	}
	float cone;
	vec3 L = keyDir(vPos, cone);
	float ndl = max(dot(N, L), 0.0);
	float sh = shadowAt(vShadow, 1.5, 0.002) * cone;
	vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
	float metal = uPm.y;
	vec3 col = albedo * (1.0 - metal) * (uLightCol * ndl * sh + hemi);
	vec3 H = normalize(L + V);
	float ndh = max(dot(N, H), 0.0);
	float a = max(rough * rough, 0.02);
	float a2 = a * a;
	float dd = ndh * ndh * (a2 - 1.0) + 1.0;
	vec3 F0 = mix(vec3(0.04), albedo, metal);
	col += F0 * uLightCol * (a2 / (PI * dd * dd)) * 0.25 * ndl * sh;
	if (metal > 0.0) {
		vec3 R = reflect(-V, N);
		col += F0 * metal * mix(uGround, uSky, smoothstep(-0.5, 0.7, R.y)) * 1.4;
	}
	float ndv = max(dot(N, V), 0.0);
	col += uRimCol * pow(1.0 - ndv, 3.0) * 0.35 * clamp(dot(N, uRimDir) * 0.5 + 0.5, 0.0, 1.0);
	col += albedo * fireLight(vPos, N);
	oCol = vec4(col, 1.0);
}`;

export const PROP_DEPTH_VS = `
in vec3 aPos;
uniform mat4 uVP;
uniform mat4 uModel;
void main() {
	gl_Position = uVP * uModel * vec4(aPos, 1.0);
}`;

export const EMPTY_FS = `
void main() {}`;

// ── framed picture hidden behind the cloth (reveal levels) ──────
export const ART_FS = `
${LIGHTS}
${SHADOW}
in vec3 vPos;
in vec3 vNrm;
in vec3 vObj;
in vec4 vShadow;
uniform sampler2D uArt;
uniform vec3 uScale;
out vec4 oCol;
void main() {
	vec2 uv = vObj.xy / uScale.xy + 0.5;
	uv.y = 1.0 - uv.y;
	vec3 albedo = texture(uArt, uv).rgb;
	float cone;
	vec3 L = keyDir(vPos, cone);
	vec3 N = normalize(vNrm);
	float sh = shadowAt(vShadow, 2.5, 0.002) * cone;
	vec3 hemi = mix(uGround, uSky, 0.5);
	// varnish glint
	vec3 V = normalize(uCam - vPos);
	float gl = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
	vec3 col = albedo * (uLightCol * max(dot(N, L), 0.0) * sh * 0.8 + hemi * 1.2) + uLightCol * gl * 0.08 * sh;
	col += albedo * fireLight(vPos, N);
	oCol = vec4(col, 1.0);
}`;

// ── particles: one instanced draw for sparks, smoke, water, fibres, confetti ──
export const PARTICLE_VS = `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPosSize;   // xyz, size
layout(location = 2) in vec4 aVelStretch; // xyz velocity, stretch
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aMisc;      // shape, rotation, additive, aspect
uniform mat4 uView;
uniform mat4 uProj;
out vec2 vUv;
out vec4 vColor;
out vec3 vMisc;
void main() {
	vec4 c = uView * vec4(aPosSize.xyz, 1.0);
	vec2 q = aCorner;
	float size = aPosSize.w;
	vec2 off;
	if (aVelStretch.w > 0.0) {
		// streaks align with their motion on screen
		vec3 v = mat3(uView) * aVelStretch.xyz;
		float sp = length(v.xy);
		vec2 dir = sp > 1e-4 ? v.xy / sp : vec2(0.0, 1.0);
		float len = size * (1.0 + sp * aVelStretch.w);
		off = dir * q.y * len + vec2(-dir.y, dir.x) * q.x * size * aMisc.w;
	} else {
		float cr = cos(aMisc.y), sr = sin(aMisc.y);
		vec2 r = vec2(q.x * aMisc.w, q.y);
		off = vec2(r.x * cr - r.y * sr, r.x * sr + r.y * cr) * size;
	}
	c.xy += off;
	vUv = q;
	vColor = aColor;
	vMisc = aMisc.xyz;
	gl_Position = uProj * c;
}`;

export const PARTICLE_FS = `
in vec2 vUv;
in vec4 vColor;
in vec3 vMisc;
uniform sampler2D uNoise;
out vec4 oCol;
void main() {
	float r2 = dot(vUv, vUv);
	float a;
	if (vMisc.x < 0.5) {
		// soft dot
		a = exp(-r2 * 3.2) * (1.0 - smoothstep(0.8, 1.0, r2));
	} else if (vMisc.x < 1.5) {
		// streak: bright core, tapering tail
		a = (1.0 - smoothstep(0.0, 1.0, abs(vUv.x))) * (1.0 - smoothstep(0.2, 1.0, abs(vUv.y)));
	} else if (vMisc.x < 2.5) {
		// hard-edged chip (confetti, fibre, scrap)
		a = 1.0 - smoothstep(0.85, 1.0, max(abs(vUv.x), abs(vUv.y)));
	} else {
		// smoke puff: billowy, uneven
		float n = texture(uNoise, vUv * 0.22 + vMisc.y * 0.31).r;
		a = exp(-r2 * 2.4) * smoothstep(0.15, 0.75, n + 0.35 - r2 * 0.35) * (1.0 - smoothstep(0.75, 1.0, r2));
	}
	a *= vColor.a;
	if (a < 0.003) discard;
	// premultiplied: additive particles add light, the rest composite over
	oCol = vec4(vColor.rgb * a, a * (1.0 - vMisc.z));
}`;

// ── post ────────────────────────────────────────────────────────
export const BRIGHT_FS = `
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uExposure;
out vec4 oCol;
void main() {
	vec3 c = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb
	       + texture(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
	c *= 0.25 * uExposure;
	float l = max(c.r, max(c.g, c.b));
	// soft knee: lit cloth stays crisp, only flame, sparks and hard glints bloom
	float k = clamp((l - 1.35) / 1.5, 0.0, 1.0);
	oCol = vec4(min(c * k * k, vec3(8.0)), 1.0);
}`;

export const DOWN_FS = `
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 oCol;
void main() {
	vec3 c = texture(uTex, vUv).rgb * 4.0;
	c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb;
	c += texture(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
	oCol = vec4(c * 0.125, 1.0);
}`;

export const UP_FS = `
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 oCol;
void main() {
	vec3 c = texture(uTex, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, 0.0)).rgb
	       + texture(uTex, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture(uTex, vUv + uTexel * vec2(0.0, 1.0)).rgb;
	c += (texture(uTex, vUv + uTexel * vec2(-0.7, -0.7)).rgb + texture(uTex, vUv + uTexel * vec2(0.7, -0.7)).rgb
	    + texture(uTex, vUv + uTexel * vec2(-0.7, 0.7)).rgb + texture(uTex, vUv + uTexel * vec2(0.7, 0.7)).rgb);
	oCol = vec4(c * 0.125, 1.0);
}`;

export const COMPOSITE_FS = `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uShake;
uniform vec4 uGrade;   // exposure, bloom, vignette, grain
uniform vec3 uTint;
uniform float uFade;   // 1 → black
uniform float uTime;
uniform float uHasBloom;
out vec4 oCol;
vec3 aces(vec3 x) {
	return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float h21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
void main() {
	// a hit zooms in a hair so the shake never shows the frame edge
	float z = 1.0 - length(uShake) * 1.5;
	vec2 uv = (vUv - 0.5) * z + 0.5 + uShake;
	vec3 col = texture(uScene, uv).rgb * uGrade.x;
	if (uHasBloom > 0.5) col += texture(uBloom, uv).rgb * uGrade.y;
	col *= uTint;
	vec2 q = vUv - 0.5;
	col *= 1.0 - uGrade.z * smoothstep(0.25, 1.05, dot(q, q) * 2.4);
	col = aces(col);
	col = pow(col, vec3(1.0 / 2.2));
	col += (h21(vUv * 1400.0 + fract(uTime) * 91.0) - 0.5) * uGrade.w;
	col *= 1.0 - uFade;
	oCol = vec4(col, 1.0);
}`;

/** Plain copy, used to blit and to rasterise cloth coverage for "reveal" objectives. */
export const COPY_FS = `
in vec2 vUv;
uniform sampler2D uTex;
out vec4 oCol;
void main() { oCol = texture(uTex, vUv); }`;
